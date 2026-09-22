# 06: Docs and hardening

**Spec:** `specs/devtools.md`

**What to build:** a developer can set devtools up from the docs alone, and the release is proven in a real browser and hardened by mutation testing.

**Blocked by:** 02, 03, 04, 05

**Status:** done

- [x] A devtools docs page under the integrations docs, with a sidebar entry, covers setup, `inspect()`, and the production import
- [x] The production import's docs warn that it exposes every row to anyone with access to the page
- [x] The docs note that values are shown unmasked until sensitive-field masking arrives
- [x] A runnable example lives in the docs examples and is synced by the docs prepare script
- [x] A CHANGELOG entry announces the package and `inspect()`
- [x] One Playwright smoke test, using the existing browser e2e setup, mounts devtools, opens the drawer, sees rows, adds a row, and sees it appear
- [x] A Stryker config covers the new package and the inspection code, with no surviving mutants in changed code
