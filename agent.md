# Agent guide (AI-assisted Champion submissions)

Many contributors will use an AI coding agent (e.g., OpenHands) to prepare their Champions PR.

This guide is written for **agents** and for **contributors prompting agents**.

## What an agent should do

For a Champion submission PR, the agent should:

1. **Only change what’s necessary** to add the contributor’s row.
2. Edit **`README.md`** and add a row to the correct table:
   - **2026 (Season 1) — Hackers** and/or
   - **2026 (Season 1) — Insiders**
3. Keep table formatting intact.
4. If this is the first real entry in a table, **remove the `_No entries yet_` placeholder row**.
5. Prefer inserting rows **alphabetically by handle** for readability.
6. Use **public, stable links**.

## Track-specific requirements the agent must enforce

### Hacker

A valid Hacker row must include:

- Project name
- Short description (1–2 sentences)
- Links to:
  - repo (if applicable)
  - write-up / blog post
  - demo (live or recorded)

Suggested `Links` format:

`[repo](...) · [write-up](...) · [demo](...)`

Badge cell should be:

`![Hacker 2026](badges/2026/openhands-hacker-2026.svg)`

### Insider

Insider rows should **not** include private attendance details.

Badge cell should be:

`![Insider 2026](badges/2026/openhands-insider-2026.svg)`

## Git workflow for agents

- Never commit directly to `main`/`master`.
- Create a branch like:
  - `add-champion-<handle>-2026` (or similar)
- Commit message suggestion:
  - `Add 2026 Champion: <handle> (<track>)`
- Push branch and open a PR.

## Prompt template (contributors → agent)

Copy/paste and fill this in:

```text
You are helping me submit a PR to the OpenHands/champions-list repo.

My track(s): [Hacker, Insider, or both]
My name/handle to display: <handle>

If Hacker:
- Project name: <name>
- Description (1–2 sentences): <desc>
- Repo link (optional): <url>
- Write-up/blog link: <url>
- Demo link: <url>

If Insider:
- Optional profile link: <url>

Requirements:
- Update README.md by adding my row to the correct 2026 table(s).
- Keep tables properly formatted.
- Remove the "_No entries yet_" row if needed.
- Create a new branch (not main), commit, push, and open a PR.
```
