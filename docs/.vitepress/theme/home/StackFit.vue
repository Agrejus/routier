<script setup lang="ts">
import HomeCard from "./HomeCard.vue";
import HomeSection from "./HomeSection.vue";

const PRINCIPLES = [
  {
    title: "Enhance, don't replace",
    body: "Keep your existing datastore. Add structure with schemas and defaults, speed with indexes and caching, and better ergonomics with live queries and optimistic updates.",
  },
  {
    title: "Swap without rewrites",
    body: "Move from IndexedDB to SQLite or adopt OPFS by changing the plugin. Your app code remains unchanged.",
  },
  {
    title: "Type checking by choice",
    body: "Use Zod or AJV for validation. Routier handles transformation and persistence.",
  },
  {
    title: "Client-first, backend-capable",
    body: "Designed for the browser and local-first workflows, while remaining adaptable to backend runtimes.",
  },
];
</script>

<template>
  <HomeSection id="fit" eyebrow="Why Routier" title="The data layer you would end up building anyway">
    <template #lede>
      Every app grows a data abstraction: defaults, business rules, computed fields, and adapters for whatever datastore
      you started with. That works until you hit a performance ceiling, need local-first, or want different storage.
      Routier is that layer, datastore-agnostic and under your control.
    </template>

    <ul class="cards">
      <li v-for="principle in PRINCIPLES" :key="principle.title">
        <HomeCard :title="principle.title">{{ principle.body }}</HomeCard>
      </li>
    </ul>
  </HomeSection>
</template>

<style scoped>
.cards {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
