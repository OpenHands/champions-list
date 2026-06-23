#!/usr/bin/env python3
"""Logic for determining whether a contributor is a first-time contributor."""

from datetime import datetime

from .github_client import GitHubClient


def is_first_time_contributor(
    client: GitHubClient,
    username: str,
    current_pr_merged_at: datetime,
) -> bool:
    """Return True when the contributor has no earlier merged PR in the org."""
    try:
        return not client.has_prior_org_merged_pr(username, current_pr_merged_at)
    except Exception as error:
        print(f"  Warning: Could not verify first-contributor status for @{username}: {error}")
        return False
