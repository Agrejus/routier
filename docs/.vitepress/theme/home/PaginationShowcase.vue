<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { data as code } from "./showcase.data.mts";
import type { Framework } from "./frameworks";
import CodeLines from "./CodeLines.vue";
import FrameworkToggle from "./FrameworkToggle.vue";
import HomeSection from "./HomeSection.vue";
import ReactShowcaseGrid from "./ReactShowcaseGrid.vue";

const VueShowcaseGrid = defineAsyncComponent(() => import("../../../_snippets/code/home/ShowcaseGrid.vue"));

const framework = ref<Framework>("react");
const grid = computed(() => code.grids[framework.value]);

const expandAbove = ref(false);
const expandBelow = ref(false);
const gridReady = ref(false);

const gridPanel = ref<HTMLElement | null>(null);
const codePanel = ref<HTMLElement | null>(null);

let sideBySide: MediaQueryList | null = null;

onMounted(() => {
  sideBySide = window.matchMedia("(min-width: 1100px)");
  sideBySide.addEventListener("change", matchPanels);
});

onBeforeUnmount(() => {
  sideBySide?.removeEventListener("change", matchPanels);
});

watch(framework, () => {
  gridReady.value = false;
});

function onGridReady() {
  gridReady.value = true;
  void matchPanels();
}

async function matchPanels() {
  const gridElement = gridPanel.value;
  const panel = codePanel.value;
  if (!gridElement || !panel || !gridReady.value) return;

  gridElement.style.removeProperty("--row-height");
  gridElement.style.minHeight = "";
  panel.style.height = "";
  if (!sideBySide?.matches) return;

  await document.fonts.ready;
  const [above, below] = [expandAbove.value, expandBelow.value];
  expandAbove.value = expandBelow.value = false;
  await nextTick();

  const codeHeight = panel.offsetHeight;
  const gridHeight = gridElement.offsetHeight;
  const rows = gridElement.querySelectorAll("tbody tr").length;
  const rowHeight = parseFloat(getComputedStyle(gridElement.querySelector("tbody td") ?? gridElement).height) || 44;
  const height = Math.max(codeHeight, gridHeight);

  if (rows > 0 && height > gridHeight) {
    gridElement.style.setProperty("--row-height", `${rowHeight + (height - gridHeight) / rows}px`);
  }
  gridElement.style.minHeight = `${height}px`;
  panel.style.height = `${height}px`;

  [expandAbove.value, expandBelow.value] = [above, below];
}
</script>

<template>
  <HomeSection id="showcase" eyebrow="Live demo" title="A live, paginated grid in one query" lead>
    <template #lede>
      This grid is a real React or Vue component running on Routier in your browser. One <code>useQuery</code> call
      sorts, pages, and subscribes, so the page stays current with no cache to invalidate and no refetch to wire up.
      Try restocking a row, turning on traffic, or switching frameworks: both read the same store.
    </template>

    <div class="showcase-toolbar">
      <FrameworkToggle v-model="framework" />
    </div>

    <div class="showcase-body">
      <div ref="gridPanel" class="panel grid-panel" :class="{ 'is-loading': !gridReady }">
        <ReactShowcaseGrid v-if="framework === 'react'" @ready="onGridReady" />
        <ClientOnly v-else>
          <VueShowcaseGrid @ready="onGridReady" />
        </ClientOnly>
      </div>

      <div ref="codePanel" class="panel code-panel">
        <div class="panel-bar">
          <span class="file">{{ grid.file }}</span>
          <span class="badge">the code this grid runs</span>
        </div>

        <div class="code">
          <button type="button" class="expander" :aria-expanded="expandAbove" @click="expandAbove = !expandAbove">
            <span aria-hidden="true">{{ expandAbove ? "▾" : "▴" }}</span>
            {{ expandAbove ? "Hide store setup" : `Show store setup · ${code.store.file} · ${code.store.lineCount} lines` }}
          </button>
          <div class="lines">
            <template v-if="expandAbove">
              <div class="file-caption">{{ code.store.file }}</div>
              <CodeLines :html="code.store.html" :first-line="code.store.firstLine" />
              <div class="file-caption">{{ grid.file }}</div>
            </template>
            <CodeLines :html="grid.focus.html" :first-line="grid.focus.firstLine" />
            <CodeLines v-show="expandBelow" :html="grid.below.html" :first-line="grid.below.firstLine" />
          </div>
          <button type="button" class="expander" :aria-expanded="expandBelow" @click="expandBelow = !expandBelow">
            <span aria-hidden="true">{{ expandBelow ? "▴" : "▾" }}</span>
            {{ expandBelow ? "Hide the rest" : `Show the rest of the component · ${grid.below.lineCount} lines` }}
          </button>
        </div>
      </div>
    </div>
  </HomeSection>
</template>

<style scoped>
.showcase-toolbar {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.showcase-body {
  position: relative;
  isolation: isolate;
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

.showcase-body::before {
  content: "";
  position: absolute;
  z-index: -1;
  inset: 12% 6%;
  background: var(--vp-home-hero-image-background-image);
  filter: blur(80px);
  opacity: 0.4;
}

.panel {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vp-c-divider);
  box-shadow: var(--vp-shadow-3);
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

.grid-panel.is-loading {
  min-height: 400px;
}

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

.file {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.badge {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-3);
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

.file-caption {
  padding: 8px 20px 4px;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  color: var(--vp-c-text-3);
}

.file-caption:first-child {
  padding-top: 0;
}
</style>
