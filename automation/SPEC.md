# Welcome New Contributors Automation

## Overview

This automation runs daily to welcome first-time contributors when their first PR is merged across OpenHands public repositories.

## Behavior

1. **Fetches merged PRs** from the last 24 hours across all public OpenHands repositories.
2. **Skips employees, bots, and service accounts** using `data/excluded-logins.json`, non-`User` authors, and `*[bot]` logins.
3. **Identifies first-time contributors** by checking whether the contributor has any merged PRs *before* the current candidate PR.
4. **Processes candidates oldest-first** so only the earliest merged PR in the window gets the welcome comment when a contributor lands multiple PRs close together.
5. **Posts a welcome comment** on the selected PR with next steps for the contributor.
6. **No state persistence** — if a run misses a contributor, they simply don't get a welcome that day.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| No persistent state | Simplifies automation; missed welcomes aren't backfilled |
| Check first PR date per contributor | Ensures we only welcome true first-timers |
| Daily cron at 12 UTC | Allows GitHub sync to run first; reasonable business hours |
| Deduplicate per run | In-memory set prevents multiple comments if same contributor has multiple PRs |
| Oldest-first processing | Keeps the public comment on the contributor's earliest merged PR in the window |

## Repositories Monitored

Dynamically discovered at runtime via GitHub GraphQL API — all public repositories in the OpenHands organization.

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token with repo scope for commenting |

## Files

```
automation/
├── drafts/
│   └── COMMUNICATION_DRAFT.md    # Message copy for review
├── tests/
│   └── test_smoke.py             # Import + entrypoint smoke checks
├── SPEC.md                       # This file
├── __init__.py                   # Package marker
├── contributor_checker.py        # First-PR detection logic
├── github_client.py              # GitHub API interactions
├── main.py                       # Entry point
├── models.py                     # Shared dataclasses
└── welcome_message.py            # Message template and posting logic
```

## Entry point

Both of these work from the repository root:

```bash
python automation/main.py
python -m automation.main
```

## Scheduling

```
0 12 * * *  # 12:00 UTC daily
```

In cron syntax: minute=0, hour=12, day=*, month=*, weekday=*

## Error Handling

- API errors: Log and continue with other PRs
- Rate limit errors: Retry once using GitHub's retry/reset headers, then surface the error
- Missing env vars: Fail fast with clear message
