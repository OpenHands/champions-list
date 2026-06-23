#!/usr/bin/env python3
"""
GitHub API client for the welcome automation.
"""

import time
from datetime import datetime
from typing import Optional
import urllib.request
import urllib.error
import json


class GitHubClient:
    ORG = "OpenHands"

    def __init__(self, token: str):
        self.token = token
        self.base_url = "https://api.github.com"
        self.rate_limit_remaining = None
        self.rate_limit_reset = None

    def get_org_public_repos(self) -> list[str]:
        """Get all public repository names for the OpenHands org."""
        repos = []
        end_cursor = None
        
        while True:
            after_clause = f', after: "{end_cursor}"' if end_cursor else ""
            
            query = """
            {
              organization(login: "OpenHands") {
                repositories(first: 100%s, privacy: PUBLIC) {
                  pageInfo { hasNextPage endCursor }
                  nodes { name }
                }
              }
            }
            """ % after_clause
            
            data = self._request_graphql(query)
            
            org = data.get("data", {}).get("organization")
            if not org:
                break
                
            page = org.get("repositories", {})
            for repo in page.get("nodes", []):
                repos.append(f"OpenHands/{repo['name']}")
            
            page_info = page.get("pageInfo", {})
            if not page_info.get("hasNextPage"):
                break
            end_cursor = page_info.get("endCursor")
        
        return repos

    def _request_graphql(self, query: str) -> dict:
        """Make a GraphQL request to the GitHub API."""
        return self._request("POST", "/graphql", {"query": query})

    def _request(self, method: str, endpoint: str, data: Optional[dict] = None) -> dict:
        """Make an authenticated request to the GitHub API."""
        url = f"{self.base_url}{endpoint}"
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        
        request_data = json.dumps(data).encode() if data else None
        if request_data:
            headers["Content-Type"] = "application/json"
        
        req = urllib.request.Request(url, data=request_data, headers=headers, method=method)
        
        try:
            with urllib.request.urlopen(req) as response:
                self._update_rate_limits(response)
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as e:
            self._update_rate_limits_from_headers(e)
            
            if e.code == 403:
                if self.rate_limit_remaining == 0:
                    reset_time = self.rate_limit_reset or time.time() + 3600
                    wait_seconds = max(1, reset_time - time.time())
                    print(f"  Rate limited. Waiting {wait_seconds:.0f} seconds...")
                    time.sleep(wait_seconds)
                    return self._request(method, endpoint, data)
            
            raise GitHubAPIError(f"HTTP {e.code}: {e.reason}", e.code)
        except urllib.error.URLError as e:
            raise GitHubAPIError(f"Network error: {e.reason}")

    def _update_rate_limits(self, response):
        """Extract rate limit info from response headers."""
        self.rate_limit_remaining = int(response.headers.get("X-RateLimit-Remaining", 0))
        reset_header = response.headers.get("X-RateLimit-Reset")
        if reset_header:
            self.rate_limit_reset = int(reset_header)

    def _update_rate_limits_from_headers(self, error: urllib.error.HTTPError):
        """Extract rate limit info from error response headers."""
        self.rate_limit_remaining = int(error.headers.get("X-RateLimit-Remaining", 0))
        reset_header = error.headers.get("X-RateLimit-Reset")
        if reset_header:
            self.rate_limit_reset = int(reset_header)

    def get_merged_prs_since(self, repo: str, since: datetime) -> list[ContributorPR]:
        """Get all merged PRs for a repo since the given datetime."""
        # Use search API to find merged PRs in time range
        since_iso = since.strftime("%Y-%m-%dT%H:%M:%SZ")
        
        # Search for PRs merged since the given time
        query = f"repo:{repo} is:pr is:merged merged:>={since_iso}"
        encoded_query = urllib.request.quote(query)
        
        results = []
        page = 1
        per_page = 100
        
        while True:
            data = self._request(
                "GET", 
                f"/search/issues?q={encoded_query}&sort=updated&order=desc&per_page={per_page}&page={page}"
            )
            
            for item in data.get("items", []):
                if item["pull_request"] is None:
                    continue
                    
                # Get the merged event from timeline
                merged_at = self._get_merged_at(repo, item["number"])
                if merged_at and merged_at >= since:
                    pr = ContributorPR(
                        repo=repo,
                        pr_number=item["number"],
                        pr_url=item["html_url"],
                        pr_title=item["title"],
                        contributor_login=item["user"]["login"],
                        contributor_id=item["user"]["id"],
                        merged_at=merged_at,
                    )
                    results.append(pr)
            
            # Check if there are more pages
            if len(data.get("items", [])) < per_page:
                break
            
            page += 1
            
            # Respect rate limits
            if self.rate_limit_remaining is not None and self.rate_limit_remaining < 10:
                print(f"  Rate limit low ({self.rate_limit_remaining}), waiting...")
                time.sleep(5)
        
        return results

    def _get_merged_at(self, repo: str, pr_number: int) -> Optional[datetime]:
        """Get the merged_at timestamp for a PR."""
        data = self._request("GET", f"/repos/{repo}/pulls/{pr_number}")
        merged_at_str = data.get("merged_at")
        
        if merged_at_str:
            return datetime.fromisoformat(merged_at_str.replace("Z", "+00:00"))
        return None

    def get_contributor_merged_prs(self, repo: str, username: str, before: datetime) -> list[dict]:
        """Get all merged PRs by a specific contributor to a repo, before a given time."""
        query = f"repo:{repo} author:{username} is:pr is:merged merged:<{before.strftime('%Y-%m-%dT%H:%M:%SZ')}"
        encoded_query = urllib.request.quote(query)
        
        data = self._request(
            "GET",
            f"/search/issues?q={encoded_query}&sort=updated&order=desc&per_page=1"
        )
        
        # If we find any, they're a returning contributor
        return data.get("items", [])

    def get_org_merged_prs_count(self, username: str) -> int:
        """
        Get total count of merged PRs by a user across all OpenHands repos.
        This is a quick check to see if they've contributed before.
        """
        query = f"org:OpenHands author:{username} is:pr is:merged"
        encoded_query = urllib.request.quote(query)
        
        data = self._request(
            "GET",
            f"/search/issues?q={encoded_query}&per_page=1"
        )
        
        return data.get("total_count", 0)

    def post_comment(self, repo: str, pr_number: int, body: str) -> bool:
        """Post a comment on a PR."""
        try:
            self._request(
                "POST",
                f"/repos/{repo}/issues/{pr_number}/comments",
                {"body": body}
            )
            return True
        except GitHubAPIError:
            return False


class GitHubAPIError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code