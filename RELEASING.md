# Releasing

Routier publishes 16 packages from one repository with npm workspaces.

Versioning is **independent by default**. On `0.x` a minor bump claims a breaking change, so
raising an unaffected package in lockstep tells every consumer to read a migration note that
does not exist.

`0.3.0` is a deliberate exception: every package moved together. That is only the right call
when a release changes `@routier/core` in a breaking way, because every plugin declares core as
a peer dependency and a consumer cannot upgrade one package without upgrading core with it.
Independent numbers would document a freedom nobody has. Do not treat it as the new default —
see the reasoning recorded in `CHANGELOG.md` under "Versions".

**Internal ranges move with the versions.** Most `@routier/*` references are dev dependencies,
but two are runtime ones: `@routier/datastore` and `@routier/replication-plugin` both depend on
`@routier/memory-plugin`. A `^0.2.1` range does not match `0.3.0`, so a version bump that leaves
those behind publishes an unsatisfiable install.

Publishing is automated by `.github/workflows/release.yml`. A package tag publishes one
independently versioned package; the manual `workflow_dispatch` path publishes a coordinated
version in dependency order. Both paths run the complete artifact gate before entering the
protected `npm` GitHub environment.

`sync-server` and `test-utils` are private workspaces. They remain in the repository and CI but
are never npm release candidates.

## One-time npm setup

The publish job uses npm trusted publishing (GitHub OIDC) and provenance. For every existing public
package, configure a trusted publisher on npmjs.com with:

- repository owner: `Agrejus`
- repository: `routier`
- workflow: `release.yml`
- environment: `npm`

Create an `npm` environment in the GitHub repository. A required reviewer is recommended because
npm publication is irreversible.

A package that has never existed on npm cannot have package-level trusted publishing configured
first. For the initial coordinated release only, add a granular automation token as the repository
Actions secret `NPM_TOKEN`. After all packages have been published and configured as trusted
publishers, delete that secret. With no token, the workflow automatically uses OIDC.

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
npm run release:pack-check     # proves every package ships dist/, README.md and LICENSE,
                               # and that main/types/exports resolve inside the tarball
npm run release:consumer-check # installs the tarballs in a clean project and runs them
```

`release:consumer-check` is the only gate that exercises the built bundle. Every other gate
reads `src/`, so a package can pass all of them and still fail on a user's first `import`.

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

## 4. Release

Publishing is irreversible. A published version cannot be replaced, only deprecated or superseded.

### Independent package release

After the version and changelog commit is on `main`, create a package tag:

```
git tag @routier/core@0.3.1
git push origin @routier/core@0.3.1
```

The tag workflow validates that the package manifest has exactly that version, rebuilds and tests
every artifact, publishes the named workspace, verifies npm, and creates the GitHub Release.

### Coordinated release

Use **Actions → Publish npm packages → Run workflow**, select `main`, enter the common version, and
type `RELEASE`. The workflow first verifies that every public package has exactly that version and
that no same-version tag points at an older commit. It then publishes in dependency order and
creates one package tag/GitHub Release per workspace. Existing npm versions and GitHub Releases are
skipped, making a partially completed coordinated release safe to retry.

Do not move a published tag. If an *unpublished* preparation tag points to an older commit, delete
it locally and remotely before starting the coordinated release, then let the workflow recreate it:

```
git tag -d @routier/core@0.3.0
git push origin :refs/tags/@routier/core@0.3.0
```

### Manual emergency fallback

If GitHub or npm OIDC is unavailable, run the checks above, then publish in the order recorded in
`scripts/release-packages.mjs`:

```
npm publish --workspace @routier/core --access public --provenance
npm view @routier/core version
```

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
