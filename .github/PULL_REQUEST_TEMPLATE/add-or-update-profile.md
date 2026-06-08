## Add or update a contributor profile

Use this template when you want to add or update the public details shown for your OpenHands Champions directory entry.

### What this PR changes
- [ ] Adds or updates my public display name
- [ ] Adds or updates my public note
- [ ] Keeps my directory entry visible
- [ ] Updates `data/contributors.overrides.json`

### My contributor details
- GitHub login:
- GitHub user ID (`githubUserId`):
- Public display name:
- Public note:

### Checklist
- [ ] I edited `data/contributors.overrides.json`
- [ ] I used my numeric `githubUserId` as the key under `contributors`
- [ ] I only changed my own entry
- [ ] I left `hidden` as `false` or omitted it entirely

### Example override
```json
"123456": {
  "name": "Ada Lovelace",
  "note": "Worked on the OpenHands CLI and SDK docs.",
  "hidden": false
}
```
