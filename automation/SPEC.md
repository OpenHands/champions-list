# Welcome New Contributors Automation

## Overview

This automation runs daily to welcome first-time contributors when their first PR is merged across OpenHands public repositories.

## Behavior

1. **Fetches merged PRs** from the last 24 hours across all configured OpenHands repositories
2. **Identifies first-time contributors** by checking if the contributor has any merged PRs *before* the current one
3. **Posts a welcome comment** on the PR with next steps for the contributor
4. **No state persistence** — if a run misses a contributor, they simply don't get a welcome that day

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| No persistent state | Simplifies automation; missed welcomes aren't backfilled |
| Check first PR date per contributor | Ensures we only welcome true first-timers |
| Daily cron at 10 UTC | Allows GitHub sync to run first; reasonable business hours |
| Deduplicate per run | In-memory set prevents multiple comments if same contributor has multiple PRs |

## Repositories Monitored

Hardcoded list of OpenHands public repositories. Can be extended.

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token with repo scope for commenting |

## Files

```
automation/
├── drafts/
│   └── COMMUNICATION_DRAFT.md    # Message copy for review
├── SPEC.md                       # This file
├── main.py                       # Entry point
├── welcome_message.py            # Message template and posting logic
├── github_client.py              # GitHub API interactions
└── contributor_checker.py        # First-PR detection logic
```

## Scheduling

```
0 12 * * *  # 12:00 UTC daily
```

In cron syntax: minute=0, hour=12, day=*, month=*, weekday=*

## Error Handling

- API errors: Log and continue with other PRs
- Rate limit errors: Respect headers, back off
- Missing env vars: Fail fast with clear message