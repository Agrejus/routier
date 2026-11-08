---
title: Generating Schemas
---

# Generating Schemas

`.compile()` builds fast functions for each schema with `new Function`. A Content-Security-Policy (CSP) without `unsafe-eval` blocks `new Function`. The Routier CLI builds those functions ahead of time, so your app runs under that policy. Your schema files stay as they are.

## Quick Navigation

- [When you need it](#when-you-need-it)
- [Generate the file](#generate-the-file)
- [Import it first](#import-it-first)
- [Keep it up to date](#keep-it-up-to-date)
- [Choose the files](#choose-the-files)
- [Types](#types)
- [Errors](#errors)

## When you need it

You need it when your app sends a CSP header and the `script-src` list has no `unsafe-eval`. Browser extensions and many company sites use a policy like this:

```http
Content-Security-Policy: script-src 'self'
```

Without that policy, the CLI is optional. `.compile()` works the same either way.

## Generate the file

Run this from your project folder. It needs Node 22 or later.

```sh
npx @routier/cli generate
```

It writes `src/routier.generated.js`, and prints the names of the schemas it found and the file's path.

Use the full name `@routier/cli`. The npm package named `routier` is a different tool.

To pin the version, install it as a dev dependency. Then call `routier generate` from a script:

```sh
npm install --save-dev @routier/cli
```

```json
{
  "scripts": {
    "routier:generate": "routier generate"
  }
}
```

## Import it first

Import the generated file in your app's entry file, before any file that compiles a schema:

```ts
import "./routier.generated.js";
import { todos } from "./schemas/todos";
```

The file registers the functions. When `.compile()` runs, it uses them in place of `new Function`.

The generated file holds only functions. Your defaults, computed properties and other code stay in your schema files.

## Keep it up to date

Run the command again after you:

- change a schema
- update `@routier/core`

A changed schema has new functions. If you forget to run the command, the app still works where eval is allowed. Under the strict policy, `.compile()` throws an error that names the schema.

You can run it before each build:

```json
{
  "scripts": {
    "build": "routier generate && vite build"
  }
}
```

## Choose the files

With no arguments, the CLI loads each file in `src` that imports `@routier/core` and calls `.compile()`. It skips test files.

The CLI runs these files in Node. A file that needs `window` or the DOM when it loads fails with the reason. To pick the files yourself, name them or use a glob:

```sh
npx @routier/cli generate "src/schemas/*.ts"
```

The CLI also loads each installed `@routier/*` package, so the schemas Routier compiles for you are in the file too. These include the replication plugin's queue and the index behind `.fullTextSearch()`. A package that cannot load in Node is skipped, and the CLI prints the reason:

```text
Skipped @routier/example-plugin: could not load it in Node: indexedDB is not defined
```

To write the file to another folder, use `--out`:

```sh
npx @routier/cli generate --out src/generated
```

## Types

Your types do not change. `InferType` and `InferCreateType` read the schema in your own files, so they work the same with or without the generated file. See [InferType](/concepts/schema/infer-type).

## Errors

If a schema has no generated function and the policy blocks eval, `.compile()` throws:

```text
The schema 'todos' has no generated function. Run "npx @routier/cli generate", and import the generated file before your schemas.
```

To fix it, run the command and check that the import comes first.

If the CLI finds no schemas, it prints `Found no compiled schemas in N files.` Check that your schema files are in `src`, or name them.
