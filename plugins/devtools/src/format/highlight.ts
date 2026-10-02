export type TokenTone = "plain" | "key" | "string" | "number" | "boolean" | "empty" | "date" | "circular";

export interface Token {
  readonly text: string;
  readonly tone: TokenTone;
}

const PATTERN =
  /((?<=^\s*)(?:[A-Za-z_$][\w$]*|"(?:[^"\\]|\\.)*")(?=: ))|("(?:[^"\\]|\\.)*")|(Date\([^)]*\))|(\[Circular\])|(\b(?:true|false)\b)|(\b(?:null|undefined)\b)|((?<![\w.])-?\d+(?:\.\d+)?(?:e[+-]\d+)?n?\b)/gm;

const TONES: ReadonlyArray<TokenTone> = ["key", "string", "date", "circular", "boolean", "empty", "number"];

function toneOfMatch(match: RegExpExecArray): TokenTone {
  return TONES[match.findIndex((group, index) => index > 0 && group !== undefined) - 1];
}

export function highlight(text: string): ReadonlyArray<Token> {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of text.matchAll(PATTERN)) {
    tokens.push({ text: text.slice(last, match.index), tone: "plain" }, { text: match[0], tone: toneOfMatch(match) });
    last = match.index + match[0].length;
  }
  tokens.push({ text: text.slice(last), tone: "plain" });
  return tokens;
}
