<script setup lang="ts">
import { FRAMEWORKS, FRAMEWORK_LABELS, type Framework } from "./frameworks";

const framework = defineModel<Framework>({ required: true });
</script>

<template>
  <div class="framework-toggle" role="group" aria-label="Framework">
    <button
      v-for="option in FRAMEWORKS"
      :key="option"
      type="button"
      class="option"
      :class="{ 'is-active': option === framework }"
      :aria-pressed="option === framework"
      @click="framework = option"
    >
      {{ FRAMEWORK_LABELS[option] }}
    </button>
  </div>
</template>

<style scoped>
.framework-toggle {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
}

.option {
  padding: 4px 16px;
  border: none;
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  background: transparent;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.option:hover {
  color: var(--vp-c-brand-1);
}

.option.is-active {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
</style>
