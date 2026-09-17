import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { highlight } from "./highlight.mts";

const source = fileURLToPath(new URL("../../../_snippets/code/home/ProductGrid.tsx", import.meta.url));

const EMPHASIS = /\.(skip|take|subscribe)\(/;
const REGION_NAMES = ["above", "focus", "below"] as const;

type RegionName = (typeof REGION_NAMES)[number];

export interface ShowcasePart {
  html: string;
  firstLine: number;
  lineCount: number;
}

export type ShowcaseData = Record<RegionName, ShowcasePart>;

declare const data: ShowcaseData;
export { data };

export default {
  watch: [source],
  async load(): Promise<ShowcaseData> {
    const regions = splitRegions(readFileSync(source, "utf8"));
    const [above, focus, below] = await Promise.all(REGION_NAMES.map(name => highlight(regions[name], EMPHASIS)));
    return {
      above: { ...above, firstLine: 1 },
      focus: { ...focus, firstLine: 1 + above.lineCount },
      below: { ...below, firstLine: 1 + above.lineCount + focus.lineCount },
    };
  },
};

function splitRegions(text: string): Record<RegionName, string> {
  const regions = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of text.split("\n")) {
    const start = line.match(/^\s*\/\/ #region (\w+)/);
    if (start) {
      current = [];
      regions.set(start[1], current);
    } else if (/^\s*\/\/ #endregion/.test(line)) {
      current = null;
    } else {
      current?.push(line);
    }
  }
  const read = (name: RegionName) => {
    const lines = regions.get(name);
    if (!lines) throw new Error(`ProductGrid.tsx is missing the "${name}" region`);
    return lines.join("\n").replace(/^\n+|\n+$/g, "");
  };
  return { above: read("above"), focus: read("focus"), below: read("below") };
}
