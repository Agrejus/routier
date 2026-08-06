# Releasing

Routier publishes 13 packages from one repository. They are versioned **independently** —
`@routier/core` is at 0.2.2 while `@routier/memory-plugin` is at 0.2.1 — and each is published
with npm workspaces.

Independent versioning is the point, not an accident. On `0.x` a minor bump claims a breaking
change, so raising an unaffected package in lockstep tells every consumer to read a migration
note that does not exist.

There is no release automation. This file is the procedure.

## Before you start

Everything here assumes CI is green on the branch you are releasing. It runs the same gates
and it is the only place bundle builds are verified — see `benchmark/README.md` and
`specs/known-defects.md` for what the numbers mean.

```
npm ci
npm run build              # required first: `files` entries pointing at a missing dist are dropped silently
npm run lint
npm run typecheck
npx jest
npm run release:pack-check # proves every package ships dist/, README.md and LICENSE,
                           # and that main/types/exports resolve inside the tarball
```

Container suites are not part of the fast gate but should pass before a release:

```
E2E_CONTAINERS=1 npx jest --selectProjects e2e
NODE_OPTIONS=--expose-gc STRESS=1 E2E_CONTAINERS=1 npx jest --selectProjects stress
```

## 1. Decide the version

Packages are on `0.x`, where **a minor bump signals a breaking change** and a patch bump
signals a fix. Read the diff, not the commit count.

Check whether the package is published at all: `npm view <name> versions`. A change to a
package that has never shipped is part of its first release, not a breaking change — there is
no earlier version to break. Two of this repository's 13 packages were unpublished at 0.2.x,
and counting their changes as breaking overstated the release.

Something is breaking if it changes a **published type**, a **constructor option**, a **column
type the plugin writes**, or the shape of data already stored by a previous version. A removed
config field breaks compilation; a changed column type breaks a database someone already has,
which is worse and easy to miss because nothing in the repository will fail.

Bump only the packages that changed. `git diff --name-only <last-release>..HEAD` grouped by
package tells you which.

## 2. Bump

```
npm run bump -- <package-name> <version>
```

`scripts/bump-version.mjs` sets the package's own version and rewrites every cross-reference
to it across the repository, preserving range prefixes (`^`, `>=`) and skipping `file:`
dependencies. Bump dependencies before dependents so the references land correctly:
`@routier/core` first, then `@routier/sql-plugin-core` and `@routier/memory-plugin`, then
everything else.

The script keeps each manifest's own indentation, so a bump is a one-line diff per file.

Quote each argument. In zsh an unquoted `$spec` does not word-split, so a loop that passes
`"<name> <version>"` as one word makes the script a silent no-op.

Then update the lockfile:

```
npm install --package-lock-only --ignore-scripts
```

`npm` rewrites `package-lock.json` at the indentation it infers from `package.json`, which can
re-indent all 34,000 lines. Normalise it back to two spaces before committing, or the real
change is unreviewable:

```
node -e 'const f=require("fs");const p=JSON.parse(f.readFileSync("package-lock.json","utf8"));f.writeFileSync("package-lock.json",JSON.stringify(p,null,2)+"\n")'
```

## 3. Write the changelog

`CHANGELOG.md` is hand-written, one section per release, grouped by package with breaking
changes first. Do not generate it: the commit messages here are prose that explains causes,
which is worth reading and does not fit a conventional-commit parser.

## 4. Publish

Publishing is irreversible. A published version cannot be replaced, only deprecated or
superseded.

```
npm publish --workspace @routier/core --access public
```

One package at a time, dependencies first, in the same order as the bumps. `sync-server` and
`test-utils` are `private: true` and are not published.

Verify before moving to the next package:

```
npm view @routier/core version
```

## 5. Tag

```
git tag @routier/core@0.3.0
git push origin --tags
```

A tag per published package, matching the published version.

## Notes

**`lerna.json` was removed (2026-08-06).** It configured `conventionalCommits: true` and a
single fixed `version` of `0.0.1-alpha.1`. Neither was true: lerna was never a dependency and
its binary was never installed, no commit follows the conventional format, and the packages had
long since diverged onto independent versions. It described a release process that did not
exist. It is in git history if you want to adopt lerna deliberately — in which case switch it
to `"version": "independent"` and either adopt conventional commits or turn that flag off.

**Native binaries.** `npm run build` needs platform binaries that npm's optional-dependency bug
(npm/cli#4828) sometimes drops. Install them together, since installing one with `--no-save`
prunes the other:

```
npm install --no-save --ignore-scripts @rspack/binding-<platform>@<@rspack/core version> @rollup/rollup-<platform>
```
