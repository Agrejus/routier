# @routier/cli

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Generates your schema functions ahead of time, so your app can run without `unsafe-eval`. Your schema files stay as they are.

**[Full guide](https://routier.dev/concepts/schema/generating-schemas)**

## Use

1. Generate the file.

   ```sh
   npx @routier/cli generate
   ```

2. Import it first in your app's entry file.

   ```ts
   import "./routier.generated.js";
   import { users } from "./schemas/users";
   ```

Run the command again after you change a schema or update `@routier/core`. If a function is missing and eval is blocked, the error names the schema and the fix.

Use the full name `@routier/cli`. The npm package named `routier` is a different tool.

## Install it in the project

To pin the version, add it as a dev dependency and call it from a script.

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

## What it scans

With no arguments, it loads the files in `src` that use `@routier/core` and call `.compile()`. It skips test files.

It also loads each installed `@routier/*` package, so the schemas Routier compiles for you are included. These include the replication plugin's queue and the index behind `.fullTextSearch()`. A package that cannot load in Node is skipped with the reason.

These files run in Node, so a file that needs `window` at import fails with the reason. You can name the files instead:

```sh
npx @routier/cli generate "src/schemas/*.ts" --out src/generated
```
