## Hide or remove my public directory entry

Use this template when you want your OpenHands Champions directory entry hidden from the public table.

### What this PR changes
- [ ] Hides my public directory entry
- [ ] Sets `hidden` to `true` in `data/contributors.overrides.json`
- [ ] Only updates my own contributor record

### My contributor details
- GitHub login:
- GitHub user ID (`githubUserId`):
- Optional note for maintainers:

### Checklist
- [ ] I edited `data/contributors.overrides.json`
- [ ] I used my numeric `githubUserId` as the key under `contributors`
- [ ] I only changed my own entry
- [ ] I set `hidden` to `true`

### Example override
```json
"123456": {
  "hidden": true
}
```

If your entry already has a `name` or `note`, you can remove those fields in the same PR if you want them gone from the repository too.
