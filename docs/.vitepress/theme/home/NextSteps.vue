<script setup lang="ts">
import { VPButton } from "vitepress/theme";
import HomeCard from "./HomeCard.vue";
import HomeSection from "./HomeSection.vue";
import InstallCommand from "./InstallCommand.vue";
import { INSTALL_COMMAND } from "./install";

const PATHS = [
  {
    title: "Build my first app",
    body: "Install the packages, define a schema, and run your first live query.",
    href: "/getting-started/quick-start",
    linkText: "Quick Start",
  },
  {
    title: "Try it without installing",
    body: "Run and edit real examples in your browser.",
    href: "/getting-started/playground",
    linkText: "Playground",
  },
  {
    title: "Decide whether it fits",
    body: "See where Routier helps and where it does not.",
    href: "/getting-started/why-routier",
    linkText: "Why Routier?",
  },
  {
    title: "Understand the core ideas",
    body: "Schemas, collections, queries, and change tracking.",
    href: "/concepts/",
    linkText: "Concepts",
  },
  {
    title: "Use it with React",
    body: "Hooks that keep components in sync with your data.",
    href: "/integrations/react/",
    linkText: "React integration",
  },
  {
    title: "Explore real patterns",
    body: "Local-first apps, syncing, history tracking, and more.",
    href: "/guides/",
    linkText: "Guides",
  },
];
</script>

<template>
  <HomeSection id="next" eyebrow="Next steps" title="Pick your path">
    <ul class="cards">
      <li v-for="path in PATHS" :key="path.href">
        <HomeCard :title="path.title" :href="path.href" :link-text="path.linkText">{{ path.body }}</HomeCard>
      </li>
    </ul>

    <div class="closing">
      <h2>Build your first live query</h2>
      <InstallCommand :command="INSTALL_COMMAND" />
      <div class="actions">
        <VPButton theme="brand" text="Quick Start" href="/getting-started/quick-start" />
        <VPButton theme="alt" text="Star on GitHub" href="https://github.com/Agrejus/routier" />
      </div>
    </div>
  </HomeSection>
</template>

<style scoped>
.cards {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.closing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  margin-top: 64px;
  padding: 48px 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  text-align: center;
  background:
    linear-gradient(120deg, rgba(0, 191, 166, 0.16), rgba(102, 126, 234, 0.16)),
    var(--vp-c-bg-soft);
}

.closing h2 {
  max-width: 560px;
  margin: 0;
  font-size: 28px;
  line-height: 36px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}
</style>
