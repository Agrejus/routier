# Releasing

Routier publishes 16 packages from one repository with npm workspaces.

Versioning is **independent by default**. On `0.x` a minor bump claims a breaking change, so
raising an unaffected package in lockstep tells every consumer to read a migration note that
does not exist.

`0.3.0` and `0.4.0` are deliberate exceptions: every package moved together, on the grounds
that a breaking core change forces every plugin along with it. **That reasoning no longer
holds.** `scripts/rspack.library.mjs` externalises peer dependencies, so a plugin dist now
`require`s core rather than inlining a copy of it, and every plugin declares core at
`>=0.4.0` — a range a higher core satisfies. `0.5.0` shipped core alone for exactly that
reason. Verify before assuming lockstep: if a plugin bundle no longer contains core symbols,
a consumer can upgrade core on its own.
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

### If `npm ci` fails before it starts

On a machine with Python 3.12 or newer, `npm ci` can die during install rather than during any
of the gates:

```
node_modules/level/node_modules/leveldown
  ModuleNotFoundError: No module named 'distutils'
  gyp ERR! node-gyp -v v8.4.1
```

`leveldown` arrives with the `pouchdb` meta-package, compiles from source, and the `node-gyp`
that `sqlite3` bundles imports `distutils` — removed from Python in 3.12. Nothing in this
repository needs the binding: the jest config already routes `pouchdb` to a memory build.

Install a `distutils` provider (`python3 -m pip install setuptools`), or point npm at an older
interpreter (`npm config set python /opt/homebrew/bin/python3.13`). Failing that:

```
npm ci --ignore-scripts     # skips the leveldown build
npm rebuild sqlite3         # sqlite3 fetches a prebuilt binary, so this needs no toolchain
```

Skipping scripts wholesale without the rebuild leaves `sqlite3` without its binding, which
fails 66 tests in `plugins/sqlite` for a reason that has nothing to do with your change.

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
re-indent all 34,000 lines. Normalise it back to **four** spaces, which is what the committed
file uses, or the real change is unreviewable — two spaces produces a ~19,000-line diff:

```
node -e 'const f=require("fs");const p=JSON.parse(f.readFileSync("package-lock.json","utf8"));f.writeFileSync("package-lock.json",JSON.stringify(p,null,4)+"\n")'
```

**Never regenerate the lockfile to fix a native binding.** Its platform coverage depends on
whether `node_modules` exists when it is written: with one present — or under a plain `npm
install` — npm prunes every platform but the current one, which is how the file came to list
only `linux-x64` rspack and rollup bindings. Declare the binding you need in root
`optionalDependencies` instead; a declared entry survives pruning, a transitive one does not.
A full regeneration also moves several hundred versions, so it belongs in its own change.

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

### Approving the publish job

Every run stops before `Publish to npm` and waits for a review of the `npm` environment. Approve it
in the run page, or from a terminal:

```
gh api repos/Agrejus/routier/actions/runs/<RUN_ID>/pending_deployments --jq '.[].environment.id'
gh api -X POST repos/Agrejus/routier/actions/runs/<RUN_ID>/pending_deployments \
  -F 'environment_ids[]=<ENV_ID>' -f state=approved -f comment=ok
```

Confirm each publish against the registry, not the workflow status. A new package can take several
minutes to appear, so `npm view` can 404 after a successful publish:

```
curl -s https://registry.npmjs.org/@routier%2Fcore | jq -r '."dist-tags".latest'
```

### If the publish job fails with a 404 on `PUT`

```
npm error 404 Not Found - PUT https://registry.npmjs.org/@routier%2fsql-plugin-core
```

This means **not authorized**. npm returns 404 rather than 403 so it does not reveal whether a
package exists. Check the credential before anything else: an expired `NPM_TOKEN`, or a missing
trusted publisher on a package that has one expected. The log reads like success until the last
line, because a signed tarball and a provenance statement are reported first.

Independent tags publish in parallel. The concurrency group is `npm-release-${{ github.ref }}`, so
one tag never cancels or queues behind another. Serialise only for a real peer dependency on a
version that is not yet on npm — peer floors are `>=`, so an already-published older version
satisfies them.

### Manual emergency fallback

If GitHub or npm OIDC is unavailable, run the checks above, then publish in the order recorded in
`scripts/release-packages.mjs`:

```
npm publish --workspace @routier/core --access public --provenance
```

A zero exit status from `npm publish` is the acknowledgement. Confirm with the registry poll
above rather than `npm view`, which 404s on a package that was just created.

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
