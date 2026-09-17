<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { Root } from "react-dom/client";
import { data as code } from "./showcase.data.mts";

const expandAbove = ref(false);
const expandBelow = ref(false);

const gridPanel = ref<HTMLElement | null>(null);
const codePanel = ref<HTMLElement | null>(null);

let root: Root | null = null;
let sideBySide: MediaQueryList | null = null;
let gridReady = false;
let disposed = false;

// React, Routier, and the grid load in the browser only; the SSR build renders
// the empty panel and the highlighted code.
onMounted(async () => {
  sideBySide = window.matchMedia("(min-width: 1100px)");
  sideBySide.addEventListener("change", matchPanels);

  const [{ createElement }, { createRoot }, { ShowcaseGrid }] = await Promise.all([
    import("react"),
    import("react-dom/client"),
    import("../../../_snippets/code/home/ShowcaseGrid"),
  ]);
  if (disposed || !gridPanel.value) return;

  root = createRoot(gridPanel.value);
  root.render(
    createElement(ShowcaseGrid, {
      onReady: () => {
        gridReady = true;
        void matchPanels();
      },
    }),
  );
});

onBeforeUnmount(() => {
  disposed = true;
  sideBySide?.removeEventListener("change", matchPanels);
  root?.unmount();
});

/**
 * Side by side, both panels start at the same height: the taller of the grid
 * (at its starting page size) and the collapsed code. The grid's rows grow to
 * fill any difference, and the code panel keeps that height, scrolling inside
 * when expanded. Other page sizes change only the grid.
 */
async function matchPanels() {
  const grid = gridPanel.value;
  const panel = codePanel.value;
  if (!grid || !panel || !gridReady) return;

  grid.style.removeProperty("--row-height");
  grid.style.minHeight = "";
  panel.style.height = "";
  if (!sideBySide?.matches) return;

  await document.fonts.ready;
  const [above, below] = [expandAbove.value, expandBelow.value];
  expandAbove.value = expandBelow.value = false;
  await nextTick();

  const codeHeight = panel.offsetHeight;
  const gridHeight = grid.offsetHeight;
  const rows = grid.querySelectorAll("tbody tr").length;
  const rowHeight = parseFloat(getComputedStyle(grid.querySelector("tbody td") ?? grid).height) || 44;
  const height = Math.max(codeHeight, gridHeight);

  if (rows > 0 && height > gridHeight) {
    grid.style.setProperty("--row-height", `${rowHeight + (height - gridHeight) / rows}px`);
  }
  grid.style.minHeight = `${height}px`;
  panel.style.height = `${height}px`;

  [expandAbove.value, expandBelow.value] = [above, below];
}
</script>

<template>
  <section class="showcase" aria-labelledby="showcase-title">
    <div class="container">
      <div class="showcase-intro">
        <h2 id="showcase-title">A live, paginated grid in one query</h2>
        <p class="lede">
          A React component with <code>useQuery</code>: sort, skip, take, and subscribe. The page stays current as data
          changes, with no cache to invalidate and no refetch to wire up. Try restocking a row or turning on traffic.
        </p>
      </div>

      <div class="showcase-body">
        <div ref="gridPanel" class="panel grid-panel" />

        <div ref="codePanel" class="panel code-panel">
          <div class="panel-bar">
            <span class="file">ProductGrid.tsx</span>
          </div>

          <div class="code">
            <button type="button" class="expander" :aria-expanded="expandAbove" @click="expandAbove = !expandAbove">
              <span aria-hidden="true">{{ expandAbove ? "▾" : "▴" }}</span>
              {{ expandAbove ? "Hide store setup" : `Show store setup · ${code.above.lineCount} lines` }}
            </button>
            <div class="lines">
              <div
                v-show="expandAbove"
                class="part"
                :style="{ counterReset: `line ${code.above.firstLine - 1}` }"
                v-html="code.above.html"
              />
              <div class="part" :style="{ counterReset: `line ${code.focus.firstLine - 1}` }" v-html="code.focus.html" />
              <div
                v-show="expandBelow"
                class="part"
                :style="{ counterReset: `line ${code.below.firstLine - 1}` }"
                v-html="code.below.html"
              />
            </div>
            <button type="button" class="expander" :aria-expanded="expandBelow" @click="expandBelow = !expandBelow">
              <span aria-hidden="true">{{ expandBelow ? "▴" : "▾" }}</span>
              {{ expandBelow ? "Hide the rest" : `Show the rest of the component · ${code.below.lineCount} lines` }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Same horizontal padding and max width as VitePress's hero and feature grid,
   so the showcase shares their left and right edges. The hero already leaves
   64px below itself; the matching bottom padding gives the features the same gap. */
.showcase {
  padding: 0 24px 48px;
}

@media (min-width: 640px) {
  .showcase {
    padding: 0 48px 64px;
  }
}

@media (min-width: 960px) {
  .showcase {
    padding: 0 64px 64px;
  }
}

.container {
  max-width: 1152px;
  margin: 0 auto;
}

.showcase-intro {
  max-width: 680px;
  margin-bottom: 24px;
}

/* Section heading and body copy use the doc theme's h2 and paragraph metrics. */
.showcase-intro h2 {
  margin: 0;
  font-size: 24px;
  line-height: 32px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.lede {
  margin: 8px 0 0;
  line-height: 28px;
  color: var(--vp-c-text-2);
}

.lede code {
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.875em;
  color: var(--vp-code-color);
  background: var(--vp-code-bg);
}

.showcase-body {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
}

@media (min-width: 1100px) {
  .showcase-body {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  }
}

/* Matches the feature cards below: soft background, 12px radius, no shadow. */
.panel {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vp-c-bg-soft);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

.panel-bar,
.grid-panel :deep(.grid-bar) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
}

/* Before React mounts, hold the grid's space so the page does not jump. */
.grid-panel:empty {
  min-height: 400px;
}

/* ── Grid (rendered by React, so its elements are reached with :deep) ── */

.grid-panel :deep(.grid-title) {
  font-weight: 600;
  font-size: 14px;
}

.grid-panel :deep(.spacer) {
  flex: 1;
}

.grid-panel :deep(.live) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.grid-panel :deep(.live .dot) {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--vp-c-text-3);
}

.grid-panel :deep(.live.is-ready) {
  color: var(--vp-c-brand-1);
}

.grid-panel :deep(.live.is-ready .dot) {
  background: var(--vp-c-brand-2);
  animation: pulse 1.8s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(0, 191, 166, 0.5);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(0, 191, 166, 0);
  }
}

.grid-panel :deep(button),
.grid-panel :deep(select) {
  font: inherit;
  font-size: 12px;
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.grid-panel :deep(button:disabled) {
  cursor: default;
  opacity: 0.45;
}

.grid-panel :deep(button:not(:disabled):hover),
.grid-panel :deep(select:hover) {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.grid-panel :deep(.chip) {
  padding: 3px 10px;
  border-radius: 999px;
}

.grid-panel :deep(.chip.is-on) {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.grid-panel :deep(.grid-body) {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.grid-panel :deep(table) {
  display: table;
  width: 100%;
  margin: 0;
  border-collapse: collapse;
  font-size: 13px;
}

.grid-panel :deep(tr) {
  border: none;
  background: transparent;
}

.grid-panel :deep(th),
.grid-panel :deep(td) {
  height: var(--row-height, 44px);
  padding: 0 12px;
  border: none;
  border-bottom: 1px solid var(--vp-c-divider);
  text-align: left;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.grid-panel :deep(th) {
  height: 34px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  background: transparent;
}

/* Columns: product, category, price, stock, restock. */
.grid-panel :deep(td:nth-child(1)) {
  font-weight: 500;
}

.grid-panel :deep(td:nth-child(2)) {
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.grid-panel :deep(th:nth-child(n + 3)),
.grid-panel :deep(td:nth-child(n + 3)) {
  text-align: right;
}

.grid-panel :deep(td button) {
  padding: 2px 8px;
  border-radius: 6px;
  color: var(--vp-c-text-2);
}

.grid-panel :deep(footer) {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}

.grid-panel :deep(footer select) {
  margin-right: auto;
  padding: 3px 6px;
  border-radius: 6px;
}

.grid-panel :deep(footer button) {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 16px;
  line-height: 1;
}

@media (max-width: 520px) {
  .grid-panel :deep(th:nth-child(2)),
  .grid-panel :deep(td:nth-child(2)) {
    display: none;
  }

  .grid-panel :deep(th),
  .grid-panel :deep(td) {
    padding: 0 8px;
  }
}

/* ── Code ── */

.file {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.code {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--vp-code-block-bg);
}

.expander {
  position: sticky;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 16px;
  border: none;
  font: inherit;
  font-size: 12px;
  text-align: left;
  color: var(--vp-c-text-2);
  /* Opaque, so code scrolling under the sticky bar does not show through. */
  background: linear-gradient(var(--vp-c-default-soft), var(--vp-c-default-soft)), var(--vp-code-block-bg);
  cursor: pointer;
  transition: color 0.15s;
}

.expander:first-child {
  top: 0;
}

.expander:last-child {
  bottom: 0;
}

.expander:hover {
  color: var(--vp-c-brand-1);
  background: linear-gradient(var(--vp-c-brand-soft), var(--vp-c-brand-soft)), var(--vp-code-block-bg);
}

.lines {
  padding: 8px 0;
}

.part :deep(pre) {
  margin: 0;
  padding: 0;
  overflow-x: auto;
  background: transparent !important;
}

.part :deep(code) {
  display: block;
  width: fit-content;
  min-width: 100%;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.7;
}

.part :deep(.line) {
  display: block;
  min-height: 1.7em;
  padding: 0 20px 0 0;
  counter-increment: line;
}

.part :deep(.line)::before {
  content: counter(line);
  display: inline-block;
  width: 2.5em;
  margin-right: 16px;
  text-align: right;
  color: var(--vp-c-text-3);
  opacity: 0.6;
  user-select: none;
}

.part :deep(.line.emphasis) {
  background: var(--vp-code-line-highlight-color);
  box-shadow: inset 3px 0 0 var(--vp-c-brand-2);
}

.part :deep(span) {
  color: var(--shiki-light);
}

.dark .part :deep(span) {
  color: var(--shiki-dark);
}
</style>
