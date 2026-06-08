# Repository Memory

- This repo hosts the OpenHands Champions contributor directory as a lightweight Next.js app for Vercel.
- Canonical public data files:
  - `data/contributors.generated.json` for generated merged-PR contributor data
  - `data/contributors.overrides.json` for contributor-supplied name/note/hidden overrides
  - `data/excluded-logins.json` for manually excluded employee/service-account logins
- Sync command: `npm run sync:contributors` (requires `GITHUB_TOKEN`).
- Daily sync is handled by `.github/workflows/sync-contributors.yml` and rewrites `README.md` as a teaser plus updates generated data.
- README regeneration preserves any content between `<!-- BEGIN MANUAL -->` and `<!-- END MANUAL -->` markers (intended for manual Hackers/Testers lists).
- Contributor avatar wall is rendered via the Next.js route `app/api/contributor-wall` (served at `/api/contributor-wall`) using the synced contributor dataset and omitting hidden contributors.

- UI reads local JSON at build time and provides client-side search/sort across merged PR contributors.
- Visual styling intentionally mirrors `OpenHands/company-website`: cream background, dark brown feature surfaces, yellow accent, and rounded card system.
- Generated contributor data now also includes a `recentMergedPrs` feed for the Fresh Merges ticker; newest contributors are derived from each contributor's `firstMergedPr` timestamp.
- Primary UI is now a sortable expandable table with two marquee-style ticker rails (`Newest Champions` and `Fresh Merges`) plus a floating accessibility control for motion/contrast.
- Contributor self-serve PR flows live in `.github/PULL_REQUEST_TEMPLATE/` with separate templates for profile enrichment and hide/remove requests.


