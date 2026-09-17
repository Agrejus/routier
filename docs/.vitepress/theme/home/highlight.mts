import { createHighlighter } from "shiki";

export interface HighlightedCode {
  html: string;
  lineCount: number;
}

let highlighterPromise: ReturnType<typeof createHighlighter> | null = null;

function getHighlighter() {
  highlighterPromise ??= createHighlighter({ themes: ["github-light", "github-dark"], langs: ["tsx"] });
  return highlighterPromise;
}

export async function highlight(code: string, emphasis: RegExp): Promise<HighlightedCode> {
  const highlighter = await getHighlighter();
  const lines = code.split("\n");
  const html = highlighter.codeToHtml(code, {
    lang: "tsx",
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
    transformers: [
      {
        line(node, line) {
          if (emphasis.test(lines[line - 1])) this.addClassToHast(node, "emphasis");
        },
      },
    ],
  });
  return {
    html: html.replace(/<\/span>\n<span class="line/g, '</span><span class="line'),
    lineCount: lines.length,
  };
}
