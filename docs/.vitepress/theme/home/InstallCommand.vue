<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";

const props = defineProps<{ command: string }>();

const copied = ref(false);
let reset: ReturnType<typeof setTimeout> | undefined;

async function copy() {
  await navigator.clipboard.writeText(props.command);
  copied.value = true;
  clearTimeout(reset);
  reset = setTimeout(() => (copied.value = false), 2000);
}

onBeforeUnmount(() => clearTimeout(reset));
</script>

<template>
  <div class="install">
    <span class="prompt" aria-hidden="true">$</span>
    <code>{{ command }}</code>
    <button type="button" @click="copy">{{ copied ? "Copied" : "Copy" }}</button>
  </div>
</template>

<style scoped>
.install {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  padding: 6px 6px 6px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 24px;
  background: var(--vp-c-bg-soft);
}

.prompt {
  color: var(--vp-c-brand-1);
  user-select: none;
}

code {
  overflow-x: auto;
  white-space: nowrap;
  text-align: left;
  color: var(--vp-c-text-1);
  scrollbar-width: none;
}

button {
  flex-shrink: 0;
  min-width: 64px;
  padding: 2px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  font-family: var(--vp-font-family-base);
  font-size: 12px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  transition: border-color 0.15s, color 0.15s;
}

button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
</style>
