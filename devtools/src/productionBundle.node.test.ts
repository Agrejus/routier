import { describe, expect, it } from "@jest/globals";
import { build } from "esbuild";
import { resolve } from "path";

const devtoolsRoot = resolve(__dirname, "..");

const app = (entry: string) => `
  import { mountRoutierDevtools } from "${entry}";
  mountRoutierDevtools({ inspect: () => ({ collections: [], disposed: new AbortController().signal }) });
`;

async function bundle(entry: string, nodeEnv: string): Promise<string> {
  const result = await build({
    stdin: { contents: app(entry), resolveDir: devtoolsRoot, loader: "ts" },
    bundle: true,
    write: false,
    minify: true,
    format: "esm",
    define: { "process.env.NODE_ENV": JSON.stringify(nodeEnv) },
    external: ["@routier/core", "@routier/core/*", "@routier/datastore"],
    jsx: "automatic",
    jsxImportSource: "preact",
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

const drawerMarker = "data-routier-devtools";

describe("production bundles", () => {
  it("drop the drawer from the main entry", async () => {
    const output = await bundle("./src/index.ts", "production");

    expect(output).not.toContain(drawerMarker);
    expect(output).not.toContain("@routier/core");
    expect(output.length).toBeLessThan(200);
  });

  it("keep the drawer in the main entry during development", async () => {
    const output = await bundle("./src/index.ts", "development");

    expect(output).toContain(drawerMarker);
  });

  it("keep the drawer in the production entry", async () => {
    const output = await bundle("./src/production.ts", "production");

    expect(output).toContain(drawerMarker);
  });
});
