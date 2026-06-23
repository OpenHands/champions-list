#!/usr/bin/env python3
"""
Welcome New Contributors Automation

Runs daily to post welcome comments on first-time contributors' merged PRs.
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import Optional

from github_client import GitHubClient
from contributor_checker import is_first_time_contributor
from welcome_message import post_welcome_comment


@dataclass
class ContributorPR:
    repo: str
    pr_number: int
    pr_url: str
    pr_title: str
    contributor_login: str
    contributor_id: int
    merged_at: datetime


def run_automation():
    """Main automation logic."""
    github_token = os.environ.get("GITHUB_TOKEN")
    if not github_token:
        print("ERROR: GITHUB_TOKEN environment variable not set")
        sys.exit(1)

    client = GitHubClient(github_token)
    
    # Calculate time window (last 24 hours)
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)
    
    print(f"[{now.isoformat()}] Starting welcome automation")
    print(f"Looking for PRs merged since {since.isoformat()}")
    
    # Dynamically discover all public repos in the org
    print("\nDiscovering public repositories...")
    try:
        repos = client.get_org_public_repos()
        print(f"Found {len(repos)} public repositories")
    except Exception as e:
        print(f"ERROR discovering repositories: {e}")
        sys.exit(1)
    
    # Track contributors we've welcomed in this run (in-memory dedup)
    welcomed_this_run: set[int] = set()
    
    total_merged = 0
    total_new_contributors = 0
    total_commented = 0
    total_errors = 0

    for repo in repos:
        print(f"\nProcessing {repo}...")
        
        try:
            merged_prs = client.get_merged_prs_since(repo, since)
            total_merged += len(merged_prs)
            print(f"  Found {len(merged_prs)} merged PRs")
        except Exception as e:
            print(f"  ERROR fetching PRs: {e}")
            total_errors += 1
            continue

        for pr in merged_prs:
            # Skip if already welcomed this run
            if pr.contributor_id in welcomed_this_run:
                print(f"  Skipping {pr.pr_url} (@{pr.contributor_login}) - already welcomed in this run")
                continue

            # Check if this is their first merged PR
            try:
                is_first = is_first_time_contributor(client, pr.contributor_login, pr.merged_at)
            except Exception as e:
                print(f"  ERROR checking contributor {pr.contributor_login}: {e}")
                total_errors += 1
                continue

            if not is_first:
                print(f"  Skipping {pr.pr_url} (@{pr.contributor_login}) - not a first-time contributor")
                continue

            # Welcome the new contributor!
            print(f"  🎉 New contributor! Welcoming @{pr.contributor_login} on {pr.pr_url}")
            
            try:
                success = post_welcome_comment(
                    client, 
                    repo, 
                    pr.pr_number, 
                    pr.contributor_login
                )
                
                if success:
                    welcomed_this_run.add(pr.contributor_id)
                    total_new_contributors += 1
                    total_commented += 1
                    print(f"  ✓ Welcome comment posted")
                else:
                    print(f"  ✗ Failed to post comment")
                    total_errors += 1
                    
            except Exception as e:
                print(f"  ERROR posting comment: {e}")
                total_errors += 1

    # Summary
    print(f"\n{'='*50}")
    print(f"Automation complete!")
    print(f"  Merged PRs processed: {total_merged}")
    print(f"  New contributors found: {total_new_contributors}")
    print(f"  Comments posted: {total_commented}")
    print(f"  Errors: {total_errors}")
    print(f"{'='*50}")


if __name__ == "__main__":
    run_automation()