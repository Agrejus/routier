<script setup lang="ts">
defineProps<{ id: string; eyebrow: string; title: string; lead?: boolean }>();
</script>

<template>
  <section class="home-section" :class="{ lead }" :aria-labelledby="`${id}-title`">
    <div class="container">
      <header class="intro">
        <p class="eyebrow">{{ eyebrow }}</p>
        <h2 :id="`${id}-title`">{{ title }}</h2>
        <div v-if="$slots.lede" class="lede"><slot name="lede" /></div>
      </header>
      <slot />
    </div>
  </section>
</template>

<style scoped>
.home-section {
  padding: 64px 24px 0;
}

.home-section.lead {
  padding-top: 0;
}

@media (min-width: 640px) {
  .home-section {
    padding: 80px 48px 0;
  }
}

@media (min-width: 960px) {
  .home-section {
    padding: 96px 64px 0;
  }
}

.container {
  max-width: 1152px;
  margin: 0 auto;
}

.intro {
  max-width: 720px;
  margin-bottom: 32px;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vp-c-brand-1);
}

.eyebrow::before {
  content: "";
  width: 24px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--routier-teal), var(--routier-indigo));
}

h2 {
  margin: 0;
  font-size: 28px;
  line-height: 36px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--vp-c-text-1);
}

@media (min-width: 960px) {
  h2 {
    font-size: 36px;
    line-height: 44px;
  }
}

.lede {
  margin-top: 12px;
  font-size: 16px;
  line-height: 28px;
  color: var(--vp-c-text-2);
}

@media (min-width: 960px) {
  .lede {
    font-size: 18px;
  }
}

.lede :deep(code) {
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.875em;
  color: var(--vp-code-color);
  background: var(--vp-code-bg);
}

.lede :deep(a) {
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
