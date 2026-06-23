#!/usr/bin/env python3
"""Welcome New Contributors Automation."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from automation.contributor_checker import is_first_time_contributor
    from automation.github_client import GitHubClient
    from automation.models import ContributorPR
    from automation.welcome_message import post_welcome_comment
else:
    from .contributor_checker import is_first_time_contributor
    from .github_client import GitHubClient
    from .models import ContributorPR
    from .welcome_message import post_welcome_comment


EXCLUDED_LOGINS_PATH = Path(__file__).resolve().parents[1] / "data" / "excluded-logins.json"


def normalize_login(login: str) -> str:
    """Normalize a GitHub login for case-insensitive comparisons."""
    return login.strip().lower()


def load_excluded_logins() -> set[str]:
    """Load the repository's employee and service-account denylist."""
    data = json.loads(EXCLUDED_LOGINS_PATH.read_text(encoding="utf-8"))
    return {
        normalize_login(entry["login"])
        for entry in data.get("logins", [])
        if entry.get("login")
    }


def get_skip_reason(pr: ContributorPR, excluded_logins: set[str]) -> str | None:
    """Return a human-readable reason when the PR author should be ignored."""
    if not pr.contributor_login:
        return "missing contributor login"

    login = normalize_login(pr.contributor_login)
    if login in excluded_logins:
        return "excluded login"

    if pr.contributor_type != "User":
        return f"author type is {pr.contributor_type or 'unknown'}"

    if login.endswith("[bot]"):
        return "bot login"

    if pr.contributor_id is None:
        return "missing contributor id"

    return None


def run_automation() -> None:
    """Run the welcome-comment automation."""
    github_token = os.environ.get("GITHUB_TOKEN")
    if not github_token:
        print("ERROR: GITHUB_TOKEN environment variable not set")
        sys.exit(1)

    try:
        excluded_logins = load_excluded_logins()
    except Exception as error:
        print(f"ERROR loading excluded logins: {error}")
        sys.exit(1)

    client = GitHubClient(github_token)

    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)

    print(f"[{now.isoformat()}] Starting welcome automation")
    print(f"Looking for PRs merged since {since.isoformat()}")

    print("\nDiscovering public repositories...")
    try:
        repos = client.get_org_public_repos()
        print(f"Found {len(repos)} public repositories")
    except Exception as error:
        print(f"ERROR discovering repositories: {error}")
        sys.exit(1)

    welcomed_this_run: set[int] = set()
    merged_pr_candidates: list[ContributorPR] = []

    total_merged = 0
    total_new_contributors = 0
    total_commented = 0
    total_errors = 0

    for repo in repos:
        print(f"\nScanning {repo}...")
        try:
            merged_prs = client.get_merged_prs_since(repo, since)
            total_merged += len(merged_prs)
            merged_pr_candidates.extend(merged_prs)
            print(f"  Found {len(merged_prs)} merged PRs in the window")
        except Exception as error:
            print(f"  ERROR fetching PRs: {error}")
            total_errors += 1

    merged_pr_candidates.sort(key=lambda pr: (pr.merged_at, pr.repo.lower(), pr.pr_number))

    for pr in merged_pr_candidates:
        skip_reason = get_skip_reason(pr, excluded_logins)
        if skip_reason:
            print(f"  Skipping {pr.pr_url} (@{pr.contributor_login or 'unknown'}) - {skip_reason}")
            continue

        contributor_id = pr.contributor_id
        if contributor_id is None:
            print(f"  Skipping {pr.pr_url} (@{pr.contributor_login}) - missing contributor id")
            continue

        if contributor_id in welcomed_this_run:
            print(f"  Skipping {pr.pr_url} (@{pr.contributor_login}) - already welcomed in this run")
            continue

        try:
            is_first = is_first_time_contributor(client, pr.contributor_login, pr.merged_at)
        except Exception as error:
            print(f"  ERROR checking contributor {pr.contributor_login}: {error}")
            total_errors += 1
            continue

        if not is_first:
            print(f"  Skipping {pr.pr_url} (@{pr.contributor_login}) - not a first-time contributor")
            continue

        print(f"  🎉 New contributor! Welcoming @{pr.contributor_login} on {pr.pr_url}")

        try:
            success = post_welcome_comment(
                client,
                pr.repo,
                pr.pr_number,
                pr.contributor_login,
            )
            if success:
                welcomed_this_run.add(contributor_id)
                total_new_contributors += 1
                total_commented += 1
                print("  ✓ Welcome comment posted")
            else:
                print("  ✗ Failed to post comment")
                total_errors += 1
        except Exception as error:
            print(f"  ERROR posting comment: {error}")
            total_errors += 1

    print(f"\n{'=' * 50}")
    print("Automation complete!")
    print(f"  Merged PRs processed: {total_merged}")
    print(f"  New contributors found: {total_new_contributors}")
    print(f"  Comments posted: {total_commented}")
    print(f"  Errors: {total_errors}")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    run_automation()
