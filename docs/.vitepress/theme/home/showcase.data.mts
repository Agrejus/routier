import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHighlighter } from "shiki";

/**
 * Highlights the homepage showcase source at build time, so the page ships
 * coloured HTML and no highlighter. The source is split on its `#region`
 * markers into the part shown by default (`focus`) and the parts the reader
 * can expand (`above`, `below`).
 */
const source = fileURLToPath(new URL("../../../_snippets/code/home/ProductGrid.tsx", import.meta.url));

// Lines that carry the pagination itself get a highlight bar.
const EMPHASIS = /\.(skip|take|subscribe)\(/;

export interface ShowcasePart {
  html: string;
  firstLine: number;
  lineCount: number;
}

export interface ShowcaseData {
  above: ShowcasePart;
  focus: ShowcasePart;
  below: ShowcasePart;
}

// One highlighter for the process: the loader re-runs on every edit in dev.
let highlighterPromise: ReturnType<typeof createHighlighter> | null = null;
function getHighlighter() {
  highlighterPromise ??= createHighlighter({ themes: ["github-light", "github-dark"], langs: ["tsx"] });
  return highlighterPromise;
}

declare const data: ShowcaseData;
export { data };

export default {
  watch: [source],
  async load(): Promise<ShowcaseData> {
    const text = readFileSync(source, "utf8");
    const regions = splitRegions(text);
    const highlighter = await getHighlighter();

    let nextLine = 1;
    const render = (code: string): ShowcasePart => {
      const lines = code.split("\n");
      const html = highlighter.codeToHtml(code, {
        lang: "tsx",
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false,
        transformers: [
          {
            line(node, line) {
              if (EMPHASIS.test(lines[line - 1])) this.addClassToHast(node, "emphasis");
            },
          },
        ],
      });
      const part = {
        // Each line is a block element; the newlines between them would add blank rows.
        html: html.replace(/<\/span>\n<span class="line/g, '</span><span class="line'),
        firstLine: nextLine,
        lineCount: lines.length,
      };
      nextLine += lines.length;
      return part;
    };

    return { above: render(regions.above), focus: render(regions.focus), below: render(regions.below) };
  },
};

function splitRegions(text: string): Record<"above" | "focus" | "below", string> {
  const regions: Record<string, string[]> = {};
  let current: string | null = null;
  for (const line of text.split("\n")) {
    const start = line.match(/^\s*\/\/ #region (\w+)/);
    if (start) {
      current = start[1];
      regions[current] = [];
      continue;
    }
    if (/^\s*\/\/ #endregion/.test(line)) {
      current = null;
      continue;
    }
    if (current) regions[current].push(line);
  }
  for (const name of ["above", "focus", "below"]) {
    if (!regions[name]) throw new Error(`ProductGrid.tsx is missing the "${name}" region`);
  }
  const trim = (lines: string[]) => lines.join("\n").replace(/^\n+|\n+$/g, "");
  return { above: trim(regions.above), focus: trim(regions.focus), below: trim(regions.below) };
}
