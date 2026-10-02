export const themeStyles = `
:host {
  all: initial;
}

.routier-devtools {
  --rd-bg: #0b1120;
  --rd-panel: #0f172a;
  --rd-raised: #162033;
  --rd-hover: #1c2940;
  --rd-border: #1f2c44;
  --rd-border-strong: #2c3b57;
  --rd-text: #e2e8f0;
  --rd-muted: #8594ab;
  --rd-faint: #56647c;
  --rd-accent: #2dd4bf;
  --rd-accent-soft: rgba(45, 212, 191, 0.14);
  --rd-view: #c4b5fd;
  --rd-view-soft: rgba(167, 139, 250, 0.16);
  --rd-debug: #f59e0b;
  --rd-error: #fca5a5;
  --rd-error-soft: rgba(248, 113, 113, 0.12);
  --rd-string: #86efac;
  --rd-number: #93c5fd;
  --rd-boolean: #f0abfc;
  --rd-date: #fcd34d;
  --rd-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: var(--rd-text);
  -webkit-font-smoothing: antialiased;
}

.routier-devtools *,
.routier-devtools *::before,
.routier-devtools *::after {
  box-sizing: border-box;
}

.routier-devtools button {
  font: inherit;
  color: inherit;
}

.routier-devtools :focus-visible {
  outline: 2px solid var(--rd-accent);
  outline-offset: 2px;
}
`;
