<script setup lang="ts">
import { withBase } from "vitepress";

defineProps<{ title: string; href?: string; linkText?: string }>();
</script>

<template>
  <component :is="href ? 'a' : 'div'" class="home-card" :class="{ link: href }" :href="href && withBase(href)">
    <h3>{{ title }}</h3>
    <p><slot /></p>
    <span v-if="linkText" class="more">{{ linkText }} <span aria-hidden="true">→</span></span>
  </component>
</template>

<style scoped>
.home-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
  border: 1px solid var(--vp-c-bg-soft);
  border-radius: 12px;
  color: inherit;
  text-decoration: none;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.home-card.link:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-2px);
  box-shadow: var(--vp-shadow-2);
}

h3 {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

p {
  flex-grow: 1;
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 24px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.more {
  margin-top: 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
}
</style>
