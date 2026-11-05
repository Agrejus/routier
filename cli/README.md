# @routier/cli

Generates your schema functions ahead of time, so your app can run without `unsafe-eval`. Your schema files stay as they are.

## Use

1. Generate the file.

   ```sh
   npx routier generate
   ```

2. Import it first in your app's entry file.

   ```ts
   import "./routier.generated.js";
   import { users } from "./schemas/users";
   ```

Run `routier generate` again after you change a schema or update `@routier/core`. If a function is missing and eval is blocked, the error names the schema and the fix.

## What it scans

With no arguments, it loads the files in `src` that use `@routier/core` and call `.compile()`. It skips test files.

These files run in Node, so a file that needs `window` at import fails with the reason. You can name the files instead:

```sh
npx routier generate "src/schemas/*.ts" --out src/generated
```

The design and plan are in `specs/cli.md`.
