import { createHighlighter } from "shiki";

export type CodeLanguage = "tsx" | "vue";

export interface HighlightedCode {
  html: string;
  lineCount: number;
}

export interface LineRange {
  start: number;
  end: number;
}

interface RenderedCode {
  open: string;
  lines: string[];
  close: string;
}

const CODE_OPEN = "<code>";
const CODE_CLOSE = "</code></pre>";

let highlighterPromise: ReturnType<typeof createHighlighter> | null = null;

function getHighlighter() {
  highlighterPromise ??= createHighlighter({ themes: ["github-light", "github-dark"], langs: ["tsx", "vue"] });
  return highlighterPromise;
}

async function render(code: string, lang: CodeLanguage, emphasis: RegExp): Promise<RenderedCode> {
  const highlighter = await getHighlighter();
  const source = code.split("\n");
  const html = highlighter.codeToHtml(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
    transformers: [
      {
        line(node, line) {
          if (emphasis.test(source[line - 1])) this.addClassToHast(node, "emphasis");
        },
      },
    ],
  });
  const bodyStart = html.indexOf(CODE_OPEN) + CODE_OPEN.length;
  const bodyEnd = html.lastIndexOf(CODE_CLOSE);
  return {
    open: html.slice(0, bodyStart),
    lines: html.slice(bodyStart, bodyEnd).split("\n"),
    close: html.slice(bodyEnd),
  };
}

export async function highlight(code: string, lang: CodeLanguage, emphasis: RegExp): Promise<HighlightedCode> {
  const [whole] = await highlightRanges(code, lang, emphasis, [{ start: 0, end: code.split("\n").length }]);
  return whole;
}

export async function highlightRanges(
  code: string,
  lang: CodeLanguage,
  emphasis: RegExp,
  ranges: LineRange[],
): Promise<HighlightedCode[]> {
  const { open, lines, close } = await render(code, lang, emphasis);
  return ranges.map(({ start, end }) => ({
    html: `${open}${lines.slice(start, end).join("")}${close}`,
    lineCount: end - start,
  }));
}
