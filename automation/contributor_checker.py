#!/usr/bin/env python3
"""
Logic for determining if a contributor is a first-time contributor.
"""

from datetime import datetime

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
    
    # If they have 1+ merged PRs, we need to check if any were before this one
    # The search API doesn't easily give us "count before timestamp", so we 
    # search for PRs before the current merge time
    
    # For efficiency: if total_count == 1 and it's this PR, they're new
    # If total_count > 1, they must have previous PRs
    if total_count == 1:
        # Only one PR total - could be this one or a different one
        # We need to check if the one they have is this PR or a different one
        # by looking at the merged time
        pass
    
    # Search for PRs merged BEFORE this one
    query = f"org:OpenHands author:{username} is:pr is:merged merged:<{current_pr_merged_at.strftime('%Y-%m-%dT%H:%M:%SZ')}"
    encoded_query = __import__('urllib.request').quote(query)
    
    try:
        data = client._request(
            "GET",
            f"/search/issues?q={encoded_query}&per_page=1&sort=updated&order=desc"
        )
        
        previous_prs = data.get("items", [])
        
        # If there are no PRs merged before this one, this IS their first
        if len(previous_prs) == 0:
            return True
        
        return False
        
    except Exception as e:
        # On error, be conservative - don't welcome them
        # They can always be welcomed manually
        print(f"  Warning: Could not verify first-contributor status: {e}")
        return False


def is_first_time_contributor_simple(client: GitHubClient, username: str) -> bool:
    """
    Simple check: does this user have ANY merged PRs in the OpenHands org?
    
    This is a faster check but less precise - it checks current state,
    not whether the current PR is specifically their first.
    
    Use this for a quick filter before doing the more expensive check.
    """
    count = client.get_org_merged_prs_count(username)
    return count == 0