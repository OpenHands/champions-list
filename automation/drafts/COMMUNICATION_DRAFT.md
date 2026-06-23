# Welcome Message Draft

## Trigger
Comment posted on a contributor's **first merged PR** to any OpenHands public repository.

---

## Welcome Message

```markdown
🎉 **Welcome as a Merged PR contributor!** 🎉

Congratulations on your first merged PR! You're a part of the [OpenHands Champions](https://champions.hub.openhands.dev/) — our public contributor directory.

**Next steps:**
- 🌟 Add your name and a note (LinkedIn, project links, etc.) by opening a PR to [openhands/champions-list](https://github.com/openhands/champions-list) and editing `data/contributors.overrides.json`
- 💬 Join the conversation on [Slack](https://go.openhands.dev) to meet other community members and maintainers
- 🐛 Browse [open issues](https://github.com/search?q=org%3AOpenHands+is%3Aissue+is%3Aopen&type=issues) to find your next contribution

Looking forward to your next contribution!

P.S. Prefer not to appear? Set `hidden: true` for your entry in the repo.
```

---

## Notes for Review

- [ ] Emoji usage — appropriate or too much?
- [ ] Link to champions list — clear?
- [ ] Instructions for adding name/note — understandable?
- [ ] Slack link — correct URL (go.openhands.dev)?
- [ ] Issue search link — useful or too generic?
- [ ] Tone — welcoming but not overwhelming?

---

## Alternative: Minimal Version

If the above is too verbose:

```markdown
🎉 **Welcome to OpenHands!** 🎉

Your first PR is merged — you're now in our [contributor directory](https://champions.hub.openhands.dev/).

Want to add your name or a note? Open a PR to [openhands/champions-list](https://github.com/openhands/champions-list).

Join us on [Slack](https://go.openhands.dev) to meet the community!
```

---

## What this automation does NOT do

- Does not backfill missed welcomes
- Does not re-welcome contributors who have already had a PR merged
- Does not track state between runs

Each run processes only PRs merged in the last 24 hours and only welcomes those whose first-ever merged PR in the org was within that window.
