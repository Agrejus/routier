# Routier CLI

`routier generate` writes your schemas' functions to one file. Import that file first, and `.compile()` no longer needs `new Function`. That lets your app run under a Content-Security-Policy (CSP) without `unsafe-eval`. Your schema files do not change.

## The problem

`schema.compile()` builds about 18 functions per schema with `new Function`. A CSP without `unsafe-eval` blocks that, so the library throws on import (see `specs/TRANSFER-CODEC-PLAN.md`).

## How it works

```
BUILD TIME                               RUN TIME
src/schemas/users.ts  (.compile())       import "./routier.generated.js"   registers functions
        |                                import { users } from "./schemas/users"
routier generate                                 |
        | loads the file, records                v
        | each function compile builds    .compile()
        v                                   hash found ----> use that function, no eval
src/routier.generated.js                    not found -----> new Function
                                                             blocked: error names the fix
```

## Key decisions

| Decision | Why |
| --- | --- |
| Schema files keep `.compile()` | Developers change one import, and nothing else. Types, `InferType` and every consumer stay as they are. |
| Compile falls back to `new Function` | Apps that allow eval need no CLI, and a stale file still works while developing. |
| A blocked fallback throws a clear error | Blocked eval with no match is the failure to explain: the error names the schema and the fix. |
| Functions are found by a hash of their source | A changed schema or a new core version finds no match, so it never runs a stale function. |
| The CLI records compiles through a global | It catches schemas that are not exported, and works when the CLI and the project have separate copies of core. The project's own core builds the source, so it matches the installed version. |
| Registered functions live on a global | A bundle can hold more than one copy of core: `@routier/core` and `@routier/core/schema` each ship their own. A per-copy registry missed every function (found in `examples/devtools`). |
| Defaults and computeds stay in the schema file | They are live closures. The generated functions receive them when compile runs. |
| Generated code is strict everywhere | ES modules are always strict, and `new Function` code was not. Both paths now run strict, so the normal test suite covers file behavior. |
| The output is `.js` with a `.d.ts` | Generated code has untyped parameters and would fail a strict `tsc`. |

## Known limits

- **Import order matters:** the generated file must load before any schema file. Otherwise the clear error appears.
- A `sideEffects: false` setting in your own `package.json` can drop the bare import. List the generated file in `sideEffects`.
- Compile still walks the schema and builds source strings at startup. It removes eval, and we measured no startup gain.
- The scan only finds files that name `@routier/core` and call `.compile()`. For a schema that imports `s` from your own re-export, name the files on the command line.
- A schema compiled inside a function that does not run at import is not recorded.
- The scanned files run in Node. A file that needs `window` at import fails with the reason.
- A scanned file that imports `routier.generated.js` fails to load if that file does not exist yet.
- The generated file adds to your bundle: about 20 KB before compression for one 12-property schema.
- `SchemaDefinition.fromJson` builds schemas at run time and still needs eval.

## Plan

### Phase 1: generate (done)

- [x] Recording and lookup in core, through `.compile()`
- [x] `routier generate`, with a scan of `src` by default
- [x] Test: a minified bundle runs in Node with code generation disabled
- [x] Test: a minified app runs in Chromium under a CSP header with no `unsafe-eval` (`npm run test:browser:csp`)

### Phase 2: daily use

- [ ] `routier generate --check` fails CI when generated files are out of date
- [ ] `routier.config.ts`, so you do not repeat the globs and folder
- [ ] `--watch`

### Phase 3: the whole library without eval

- [ ] Replication: `UnsyncedQueue.ts` and `conditionalRevalidation.ts` compile at import
- [ ] Full text search: `fullTextSearch.ts` compiles an index schema at run time
- [ ] Add the other storage plugins to the CSP test. Memory and Dexie are covered.

### Phase 4: publish

- [x] Remove `private`, then add the package to `pack-check` and `release-packages`
- [x] Add a docs page: `docs/concepts/schema/generating-schemas.md`
- [x] Run it as `npx @routier/cli generate`. The npm name `routier` belongs to another tool.
- [ ] Release a core version with `registerGeneratedFunctions`, and raise the CLI's `@routier/core` peer range to it
- [ ] Publish `@routier/cli`

### Later

- `routier pull` and `routier migrate`, from `FEATURE-IDEAS.md`
