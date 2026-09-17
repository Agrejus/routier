import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { highlight, highlightRanges, type CodeLanguage, type LineRange } from "./highlight.mts";
import type { Framework } from "./frameworks.ts";

const EMPHASIS = /\.(skip|take|subscribe)\(/;
const REGION_NAMES = ["focus", "below"] as const;
const REGION_START = /^\s*(?:\/\/|<!--) #region (\w+)/;
const REGION_END = /^\s*(?:\/\/|<!--) #endregion/;
const STORE_FILE = "inventory.ts";

interface GridSource {
  file: string;
  lang: CodeLanguage;
}

const GRID_FILES: Record<Framework, GridSource> = {
  react: { file: "ProductGrid.tsx", lang: "tsx" },
  vue: { file: "ProductGrid.vue", lang: "vue" },
};

type RegionName = (typeof REGION_NAMES)[number];

export interface ShowcasePart {
  html: string;
  firstLine: number;
  lineCount: number;
}

export interface ShowcaseFile {
  file: string;
  focus: ShowcasePart;
  below: ShowcasePart;
}

export interface ShowcaseData {
  store: ShowcasePart & { file: string };
  grids: Record<Framework, ShowcaseFile>;
}

declare const data: ShowcaseData;
export { data };

const snippetPath = (file: string) => fileURLToPath(new URL(`../../../_snippets/code/home/${file}`, import.meta.url));

export default {
  watch: [STORE_FILE, ...Object.values(GRID_FILES).map(grid => grid.file)].map(snippetPath),
  async load(): Promise<ShowcaseData> {
    const storeCode = await highlight(readFileSync(snippetPath(STORE_FILE), "utf8").trim(), "tsx", EMPHASIS);
    const [react, vue] = await Promise.all([loadGrid(GRID_FILES.react), loadGrid(GRID_FILES.vue)]);
    return {
      store: { ...storeCode, file: STORE_FILE, firstLine: 1 },
      grids: { react, vue },
    };
  },
};

async function loadGrid({ file, lang }: GridSource): Promise<ShowcaseFile> {
  const { code, ranges } = splitRegions(file, readFileSync(snippetPath(file), "utf8"));
  const [focus, below] = await highlightRanges(code, lang, EMPHASIS, REGION_NAMES.map(name => ranges[name]));
  return {
    file,
    focus: { ...focus, firstLine: 1 },
    below: { ...below, firstLine: 1 + focus.lineCount },
  };
}

function splitRegions(file: string, text: string): { code: string; ranges: Record<RegionName, LineRange> } {
  const kept: string[] = [];
  const found = new Map<string, LineRange>();
  let open: { name: string; start: number } | null = null;
  for (const line of text.split("\n")) {
    const start = line.match(REGION_START);
    if (start) {
      open = { name: start[1], start: kept.length };
    } else if (REGION_END.test(line)) {
      if (open) found.set(open.name, { start: open.start, end: kept.length });
      open = null;
    } else if (open) {
      kept.push(line);
    }
  }
  const read = (name: RegionName): LineRange => {
    const range = found.get(name);
    if (!range) throw new Error(`${file} is missing the "${name}" region`);
    return trimBlankLines(kept, range);
  };
  return { code: kept.join("\n"), ranges: { focus: read("focus"), below: read("below") } };
}

function trimBlankLines(lines: string[], { start, end }: LineRange): LineRange {
  let first = start;
  let last = end;
  while (first < last && lines[first].trim() === "") first++;
  while (last > first && lines[last - 1].trim() === "") last--;
  return { start: first, end: last };
}
