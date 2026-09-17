import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { highlight } from "./highlight.mts";

const source = fileURLToPath(new URL("../../../_snippets/code/home/inventory.ts", import.meta.url));

const BASE_IMPORT = 'import { MemoryPlugin } from "@routier/memory-plugin";';
const BASE_PLUGIN = 'new MemoryPlugin("inventory")';
const STORE_CLASS = /^class InventoryStore [\s\S]*?^}$/m;
const PLUGIN_DOCS = "/integrations/plugins/built-in-plugins";

interface StoragePlugin {
  id: string;
  label: string;
  runsIn: string;
  className: string;
  packageName: string;
  argument: string;
  link: string;
}

const PLUGINS: StoragePlugin[] = [
  {
    id: "memory",
    label: "Memory",
    runsIn: "Anywhere",
    className: "MemoryPlugin",
    packageName: "@routier/memory-plugin",
    argument: '"inventory"',
    link: `${PLUGIN_DOCS}/memory/README`,
  },
  {
    id: "indexeddb",
    label: "IndexedDB",
    runsIn: "Browser",
    className: "DexiePlugin",
    packageName: "@routier/dexie-plugin",
    argument: '"inventory"',
    link: `${PLUGIN_DOCS}/dexie/README`,
  },
  {
    id: "sqlite",
    label: "SQLite",
    runsIn: "Node, browser, and edge",
    className: "SqliteDbPlugin",
    packageName: "@routier/sqlite-plugin",
    argument: '"inventory.db"',
    link: `${PLUGIN_DOCS}/sqlite/README`,
  },
  {
    id: "postgresql",
    label: "PostgreSQL",
    runsIn: "Server",
    className: "PostgresDbPlugin",
    packageName: "@routier/postgresql-plugin",
    argument: '{ database: "inventory" }',
    link: `${PLUGIN_DOCS}/server-databases`,
  },
];

export interface SwapVariant {
  id: string;
  label: string;
  runsIn: string;
  packageName: string;
  link: string;
  html: string;
}

declare const data: SwapVariant[];
export { data };

export default {
  watch: [source],
  load(): Promise<SwapVariant[]> {
    const storeClass = readStoreClass(readFileSync(source, "utf8"));
    return Promise.all(
      PLUGINS.map(async ({ className, argument, ...plugin }) => {
        const code = `${BASE_IMPORT}\n\n${storeClass}`
          .replace(BASE_IMPORT, `import { ${className} } from "${plugin.packageName}";`)
          .replace(BASE_PLUGIN, `new ${className}(${argument})`);
        const { html } = await highlight(code, "tsx", new RegExp(`\\b${className}\\b`));
        return { ...plugin, html };
      }),
    );
  },
};

function readStoreClass(text: string): string {
  const storeClass = text.match(STORE_CLASS)?.[0];
  if (!storeClass || !text.includes(BASE_IMPORT) || !storeClass.includes(BASE_PLUGIN)) {
    throw new Error("inventory.ts no longer declares InventoryStore on the memory plugin");
  }
  return storeClass;
}
