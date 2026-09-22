<script setup lang="ts">
import HomeSection from "./HomeSection.vue";

const VIEWS = [
  {
    src: "/devtools/data.png",
    alt: "The Routier devtools Data view: a collection list with row counts, a table of products, and one product's full value.",
    title: "Your data, live",
    body: "Every collection and view with a live row count, a paged table of rows, and the full value of any row. It updates as saves, syncs, and other tabs change the data.",
  },
  {
    src: "/devtools/queries.png",
    alt: "The Routier devtools Queries tab: a recorded query on SQLite, with the SQL statement and bound parameters it sent.",
    title: "Every query, explained",
    body: "The Queries tab records each query your app runs and shows its plan: the SQL or other statement it sent, its parameters, and anything that ran in memory, and why.",
  },
];
</script>

<template>
  <HomeSection id="devtools" eyebrow="New · Devtools" title="See inside your store">
    <template #lede>
      <code>@routier/devtools</code> adds a drawer to your page that shows what your store holds and how every query
      runs. One line to set up, in React, Vue, or plain JavaScript, and stripped from production builds. It is running
      on this page now: click the <strong>Routier</strong> button in the bottom-right corner.
    </template>

    <div class="setup">
      <code>mountRoutierDevtools(store);</code>
      <div class="actions">
        <a class="action primary" href="/integrations/devtools/">Set up devtools</a>
        <a class="action" href="/lab/#inspector" target="_self">See query plans in the Lab</a>
      </div>
    </div>

    <ul class="views">
      <li v-for="view in VIEWS" :key="view.src" class="view">
        <img :src="view.src" :alt="view.alt" width="1280" height="440" loading="lazy" />
        <h3>{{ view.title }}</h3>
        <p>{{ view.body }}</p>
      </li>
    </ul>
  </HomeSection>
</template>

<style scoped>
.setup {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 32px;
  padding: 16px 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.setup > code {
  font-size: 15px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.action {
  padding: 8px 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: border-color 0.2s, color 0.2s;
}

.action:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.action.primary {
  border-color: var(--vp-button-brand-border);
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
}

.action.primary:hover {
  border-color: var(--vp-button-brand-hover-border);
  background: var(--vp-button-brand-hover-bg);
  color: var(--vp-button-brand-hover-text);
}

.views {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.view img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(2, 6, 23, 0.18);
}

.view h3 {
  margin: 16px 0 6px;
  font-size: 18px;
  font-weight: 600;
}

.view p {
  margin: 0;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}
</style>
