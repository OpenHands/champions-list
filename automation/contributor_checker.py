#!/usr/bin/env python3
"""
Logic for determining if a contributor is a first-time contributor.
"""

from datetime import datetime
import urllib.request

from github_client import GitHubClient


def is_first_time_contributor(
    client: GitHubClient, 
    username: str, 
    current_pr_merged_at: datetime
) -> bool:
    """
    Check if a contributor is making their first merged PR.
    
    This queries the GitHub search API to see if the user has any merged
    PRs in the OpenHands org before the current PR's merge time.
    
    Args:
        client: GitHubClient instance
        username: GitHub username to check
        current_pr_merged_at: When the current PR was merged
        
    Returns:
        True if this is their first merged PR in the org, False otherwise
    """
    # Quick check: get total count of their merged PRs in the org
    total_count = client.get_org_merged_prs_count(username)
    
    # If they have 0 merged PRs, this is definitely their first
    if total_count == 0:
        return True
    
    # Search for PRs merged BEFORE this one
    query = f"org:OpenHands author:{username} is:pr is:merged merged:<{current_pr_merged_at.strftime('%Y-%m-%dT%H:%M:%SZ')}"
    encoded_query = urllib.request.quote(query)
    
    try:
        data = client._request(
            "GET",
            f"/search/issues?q={encoded_query}&per_page=1&sort=updated&order=desc"
        )
        
        previous_prs = data.get("items", [])
        
        # If there are no PRs merged before this one, this IS their first
        return len(previous_prs) == 0
        
    except Exception as e:
        # On error, be conservative - don't welcome them
        # They can always be welcomed manually
        print(f"  Warning: Could not verify first-contributor status: {e}")
        return False