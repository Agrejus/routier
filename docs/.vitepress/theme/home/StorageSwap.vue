<script setup lang="ts">
import { computed, ref } from "vue";
import { withBase } from "vitepress";
import { data as variants } from "./swap.data.mts";
import CodeLines from "./CodeLines.vue";
import HomeSection from "./HomeSection.vue";

const UNCHANGED = [
  "Schemas and inferred types",
  "Queries and live subscriptions",
  "Components and hooks",
  "Change tracking and saves",
];

const selectedId = ref(variants[0].id);
const selected = computed(() => variants.find(variant => variant.id === selectedId.value) ?? variants[0]);
</script>

<template>
  <HomeSection id="swap" eyebrow="Swappable storage" title="Change one line. Keep your app.">
    <template #lede>
      The grid above runs on the memory plugin. Moving it to IndexedDB, SQLite, or PostgreSQL means changing the plugin
      the store is built with, and nothing else.
    </template>

    <div class="swap">
      <div class="panel">
        <div class="tabs" role="tablist" aria-label="Storage plugin">
          <button
            v-for="variant in variants"
            :id="`swap-tab-${variant.id}`"
            :key="variant.id"
            type="button"
            role="tab"
            :aria-selected="variant.id === selectedId"
            aria-controls="swap-code"
            @click="selectedId = variant.id"
          >
            {{ variant.label }}
          </button>
        </div>

        <div id="swap-code" class="code" role="tabpanel" :aria-labelledby="`swap-tab-${selected.id}`">
          <CodeLines :html="selected.html" />
        </div>

        <div class="meta">
          <code>npm install {{ selected.packageName }}</code>
          <span>Runs in: {{ selected.runsIn }}</span>
          <a :href="withBase(selected.link)">{{ selected.label }} plugin docs →</a>
        </div>
      </div>

      <aside class="unchanged">
        <h3>What you don't touch</h3>
        <ul>
          <li v-for="item in UNCHANGED" :key="item">{{ item }}</li>
        </ul>
        <p>
          Also available: MySQL, MongoDB, PouchDB, PGlite, files, and browser storage, plus wrappers for caching,
          replication, and encryption.
        </p>
        <a class="more" :href="withBase('/integrations/plugins/built-in-plugins/')">Choose your plugins →</a>
      </aside>
    </div>
  </HomeSection>
</template>

<style scoped>
.swap {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr);
}

@media (min-width: 960px) {
  .swap {
    grid-template-columns: minmax(0, 7fr) minmax(0, 4fr);
  }
}

.panel {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  box-shadow: var(--vp-shadow-2);
  overflow: hidden;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 0 8px;
  border-bottom: 1px solid var(--vp-c-divider);
  overflow-x: auto;
}

.tabs button {
  padding: 12px;
  border-bottom: 2px solid transparent;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  color: var(--vp-c-text-2);
  transition: color 0.15s, border-color 0.15s;
}

.tabs button:hover {
  color: var(--vp-c-text-1);
}

.tabs button[aria-selected="true"] {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.code {
  flex: 1;
  padding: 16px 0;
  background: var(--vp-code-block-bg);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 20px;
  padding: 10px 16px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.meta code {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-1);
}

.meta a {
  margin-left: auto;
}

.meta a,
.more {
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.meta a:hover,
.more:hover {
  color: var(--vp-c-brand-2);
}

.unchanged {
  padding: 24px;
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.unchanged h3 {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
}

.unchanged ul {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.unchanged li {
  display: flex;
  gap: 10px;
  padding: 6px 0;
  font-size: 14px;
  line-height: 24px;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.unchanged li::before {
  content: "✓";
  font-weight: 700;
  color: var(--vp-c-brand-1);
}

.unchanged p {
  margin: 16px 0;
  padding-top: 16px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 14px;
  line-height: 24px;
  color: var(--vp-c-text-2);
}
</style>
