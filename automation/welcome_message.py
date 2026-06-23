#!/usr/bin/env python3
"""
Welcome message template and posting logic.
"""

from github_client import GitHubClient


WELCOME_MESSAGE = """🎉 **Welcome as a Merged PR contributor!** 🎉

Congratulations on your first merged PR! You're a part of the [OpenHands Champions](https://champions.hub.openhands.dev/) — our public contributor directory.

**Next steps:**
- 🌟 Add your name and a note (LinkedIn, project links, etc.) by opening a PR to [openhands/champions-list](https://github.com/openhands/champions-list) and editing `data/contributors.overrides.json`
- 💬 Join the conversation on [Slack](https://go.openhands.dev) to meet other community members and maintainers
- 🐛 Browse [open issues](https://github.com/search?q=org%3AOpenHands+is%3Aissue+is%3Aopen&type=issues) to find your next contribution

Looking forward to your next contribution!

P.S. Prefer not to appear? Set `hidden: true` for your entry in the repo."""


WELCOME_MESSAGE_MINIMAL = """🎉 **Welcome to OpenHands!** 🎉

Your first PR is merged — you're now in our [contributor directory](https://champions.hub.openhands.dev/).

Add your name and a note (LinkedIn, links, etc.) by opening a PR to [openhands/champions-list](https://github.com/openhands/champions-list). Prefer not to appear? Set `hidden: true`.

Join us on [Slack](https://go.openhands.dev) to meet the community!"""


def post_welcome_comment(
    client: GitHubClient,
    repo: str,
    pr_number: int,
    contributor_username: str,
    use_minimal: bool = False
) -> bool:
    """
    Post a welcome comment on a contributor's PR.
    
    Args:
        client: GitHubClient instance
        repo: Repository full name (e.g., "OpenHands/software-agent-sdk")
        pr_number: PR number
        contributor_username: GitHub username of the contributor
        use_minimal: Use the minimal message instead of the full one
        
    Returns:
        True if comment was posted successfully, False otherwise
    """
    message = WELCOME_MESSAGE_MINIMAL if use_minimal else WELCOME_MESSAGE
    
    try:
        success = client.post_comment(repo, pr_number, message)
        
        if success:
            print(f"  ✓ Posted welcome comment to @{contributor_username}'s PR #{pr_number}")
        else:
            print(f"  ✗ Failed to post welcome comment to @{contributor_username}'s PR #{pr_number}")
            
        return success
        
    except Exception as e:
        print(f"  ✗ Error posting welcome comment: {e}")
        return False


def get_welcome_message(use_minimal: bool = False) -> str:
    """Get the welcome message text."""
    return WELCOME_MESSAGE_MINIMAL if use_minimal else WELCOME_MESSAGE