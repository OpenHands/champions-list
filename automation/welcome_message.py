#!/usr/bin/env python3
"""Welcome message template and posting logic."""

from .github_client import GitHubClient


AI_DISCLOSURE_FOOTER = (
    "\n\n---\n"
    "_This automated welcome message was posted by an AI agent (OpenHands) on behalf of the OpenHands team._"
)

WELCOME_MESSAGE = f"""🎉 **Welcome as a Merged PR contributor!** 🎉

Congratulations on your first merged PR! You're a part of the [OpenHands Champions](https://champions.hub.openhands.dev/) — our public contributor directory.

**Next steps:**
- 🌟 Add your name and a note (LinkedIn, project links, etc.) by opening a PR to [openhands/champions-list](https://github.com/openhands/champions-list) and editing `data/contributors.overrides.json`
- 💬 Join the conversation on [Slack](https://go.openhands.dev) to meet other community members and maintainers
- 🐛 Browse [open issues](https://github.com/search?q=org%3AOpenHands+is%3Aissue+is%3Aopen&type=issues) to find your next contribution

Looking forward to your next contribution!

P.S. Prefer not to appear? Open a PR to set `hidden: true` in the repo.{AI_DISCLOSURE_FOOTER}"""

WELCOME_MESSAGE_MINIMAL = f"""🎉 **Welcome to OpenHands!** 🎉

Your first PR is merged — you're now in our [contributor directory](https://champions.hub.openhands.dev/).

Add your name and a note (LinkedIn, links, etc.) by opening a PR to [openhands/champions-list](https://github.com/openhands/champions-list). Prefer not to appear? Open a PR to set `hidden: true`.

Join us on [Slack](https://go.openhands.dev) to meet the community!{AI_DISCLOSURE_FOOTER}"""


def post_welcome_comment(
    client: GitHubClient,
    repo: str,
    pr_number: int,
    contributor_username: str,
    use_minimal: bool = False,
) -> bool:
    """Post a welcome comment on a contributor's PR."""
    message = WELCOME_MESSAGE_MINIMAL if use_minimal else WELCOME_MESSAGE

    try:
        success = client.post_comment(repo, pr_number, message)

        if success:
            print(f"  ✓ Posted welcome comment to @{contributor_username}'s PR #{pr_number}")
        else:
            print(f"  ✗ Failed to post welcome comment to @{contributor_username}'s PR #{pr_number}")

        return success
    except Exception as error:
        print(f"  ✗ Error posting welcome comment: {error}")
        return False


def get_welcome_message(use_minimal: bool = False) -> str:
    """Get the welcome message text."""
    return WELCOME_MESSAGE_MINIMAL if use_minimal else WELCOME_MESSAGE
