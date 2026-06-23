#!/usr/bin/env python3
"""GitHub API client for the welcome automation."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Optional

from .models import ContributorPR


class GitHubClient:
    ORG = "OpenHands"

    def __init__(self, token: str):
        self.token = token
        self.base_url = "https://api.github.com"
        self.rate_limit_remaining: Optional[int] = None
        self.rate_limit_reset: Optional[int] = None
        self.rate_limit_resource: Optional[str] = None

    def get_org_public_repos(self) -> list[str]:
        """Get all public repository names for the OpenHands org."""
        query = """
        query PublicRepos($org: String!, $cursor: String) {
          organization(login: $org) {
            repositories(first: 100, after: $cursor, privacy: PUBLIC, orderBy: { field: NAME, direction: ASC }) {
              nodes { name }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
        """

        repos: list[str] = []
        cursor = None

        while True:
            data = self._request_graphql(query, {"org": self.ORG, "cursor": cursor})
            page = data.get("data", {}).get("organization", {}).get("repositories")
            if not page:
                break

            repos.extend(f"{self.ORG}/{repo['name']}" for repo in page.get("nodes", []))

            page_info = page.get("pageInfo", {})
            if not page_info.get("hasNextPage"):
                break
            cursor = page_info.get("endCursor")

        return repos

    def get_merged_prs_since(self, repo: str, since: datetime) -> list[ContributorPR]:
        """Get merged PRs for a repo whose merge timestamp falls within the time window."""
        query = """
        query RepoRecentMergedPullRequests($org: String!, $repo: String!, $cursor: String) {
          repository(owner: $org, name: $repo) {
            pullRequests(first: 100, after: $cursor, states: MERGED, orderBy: { field: UPDATED_AT, direction: DESC }) {
              nodes {
                number
                title
                url
                mergedAt
                updatedAt
                author {
                  __typename
                  login
                  ... on User {
                    databaseId
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
        """

        results: list[ContributorPR] = []
        cursor = None

        while True:
            data = self._request_graphql(query, {"org": self.ORG, "repo": repo.split("/", 1)[1], "cursor": cursor})
            page = data.get("data", {}).get("repository", {}).get("pullRequests")
            if not page:
                break

            nodes = page.get("nodes", [])
            for node in nodes:
                merged_at_str = node.get("mergedAt")
                if not merged_at_str:
                    continue

                merged_at = self._parse_datetime(merged_at_str)
                if merged_at < since:
                    continue

                author = node.get("author") or {}
                results.append(
                    ContributorPR(
                        repo=repo,
                        pr_number=node["number"],
                        pr_url=node["url"],
                        pr_title=node["title"],
                        contributor_login=author.get("login", ""),
                        contributor_id=author.get("databaseId"),
                        contributor_type=author.get("__typename", ""),
                        merged_at=merged_at,
                    )
                )

            page_info = page.get("pageInfo", {})
            if not page_info.get("hasNextPage"):
                break

            if self._page_is_older_than_window(nodes, since):
                break

            cursor = page_info.get("endCursor")
            if not cursor:
                break

        return results

    def has_prior_org_merged_pr(self, username: str, before: datetime) -> bool:
        """Return True when the contributor has any earlier merged PR in the org."""
        query = """
        query PriorMergedPullRequest($query: String!) {
          search(query: $query, type: ISSUE, first: 1) {
            nodes {
              ... on PullRequest {
                number
              }
            }
          }
        }
        """
        search_query = (
            f"org:{self.ORG} author:{username} is:pr is:merged "
            f"merged:<{before.strftime('%Y-%m-%dT%H:%M:%SZ')}"
        )
        data = self._request_graphql(query, {"query": search_query})
        nodes = data.get("data", {}).get("search", {}).get("nodes", [])
        return len(nodes) > 0

    def post_comment(self, repo: str, pr_number: int, body: str) -> bool:
        """Post a comment on a PR."""
        try:
            self._request(
                "POST",
                f"/repos/{repo}/issues/{pr_number}/comments",
                {"body": body},
            )
            return True
        except GitHubAPIError:
            return False

    def _request_graphql(self, query: str, variables: Optional[dict[str, object]] = None) -> dict[str, Any]:
        """Make a GraphQL request to the GitHub API."""
        payload: dict[str, object] = {"query": query}
        if variables is not None:
            payload["variables"] = variables

        data = self._request("POST", "/graphql", payload)
        errors = data.get("errors")
        if errors:
            message = "; ".join(error.get("message", "Unknown GraphQL error") for error in errors)
            raise GitHubAPIError(message)
        return data

    def _request(self, method: str, endpoint: str, data: Optional[dict[str, object]] = None) -> dict[str, Any]:
        """Make an authenticated request to the GitHub API with bounded rate-limit retries."""
        url = f"{self.base_url}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "OpenHands Champions Welcome Automation",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        request_data = json.dumps(data).encode() if data else None
        if request_data:
            headers["Content-Type"] = "application/json"

        for attempt in range(2):
            req = urllib.request.Request(url, data=request_data, headers=headers, method=method)
            try:
                with urllib.request.urlopen(req) as response:
                    self._update_rate_limits(response)
                    return json.loads(response.read().decode())
            except urllib.error.HTTPError as error:
                self._update_rate_limits(error)
                error_body = self._read_error_body(error)
                retry_after = self._get_retry_after_seconds(error, error_body)
                if retry_after is not None and attempt == 0:
                    resource = self.rate_limit_resource or "api"
                    print(f"  {resource.capitalize()} rate limited. Waiting {retry_after:.0f} seconds...")
                    time.sleep(retry_after)
                    continue

                raise GitHubAPIError(self._build_http_error_message(error, error_body), error.code) from error
            except urllib.error.URLError as error:
                raise GitHubAPIError(f"Network error: {error.reason}") from error

        raise GitHubAPIError("Request failed after retry")

    def _update_rate_limits(self, response: Any) -> None:
        """Extract rate limit info from response headers."""
        self.rate_limit_remaining = self._parse_int(response.headers.get("X-RateLimit-Remaining"))
        self.rate_limit_reset = self._parse_int(response.headers.get("X-RateLimit-Reset"))
        self.rate_limit_resource = response.headers.get("X-RateLimit-Resource")

    def _get_retry_after_seconds(
        self,
        error: urllib.error.HTTPError,
        error_body: str,
    ) -> Optional[float]:
        """Return a bounded retry delay when the error looks rate-limit related."""
        if error.code not in {403, 429}:
            return None

        retry_after = self._parse_int(error.headers.get("Retry-After"))
        if retry_after is not None:
            return max(1.0, float(retry_after))

        message = error_body.lower()
        if self.rate_limit_remaining == 0 or "rate limit" in message or "secondary rate limit" in message:
            reset_time = self.rate_limit_reset or int(time.time()) + 60
            return max(1.0, min(float(reset_time - time.time()), 300.0))

        return None

    def _build_http_error_message(
        self,
        error: urllib.error.HTTPError,
        error_body: str,
    ) -> str:
        """Create a readable error message from an HTTP error."""
        body = error_body.strip()
        if body:
            return f"HTTP {error.code}: {error.reason} - {body}"
        return f"HTTP {error.code}: {error.reason}"

    def _read_error_body(self, error: urllib.error.HTTPError) -> str:
        """Safely read the HTTP error body without raising secondary errors."""
        try:
            return error.read().decode("utf-8", errors="replace")
        except Exception:
            return ""

    def _page_is_older_than_window(self, nodes: list[dict[str, Any]], since: datetime) -> bool:
        """Return True when an entire page is older than the requested time window."""
        updated_at_values = [
            self._parse_datetime(node["updatedAt"])
            for node in nodes
            if node.get("updatedAt")
        ]
        return bool(updated_at_values) and all(updated_at < since for updated_at in updated_at_values)

    @staticmethod
    def _parse_int(value: Optional[str]) -> Optional[int]:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _parse_datetime(value: str) -> datetime:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


class GitHubAPIError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code
