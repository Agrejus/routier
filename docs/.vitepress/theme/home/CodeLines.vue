<script setup lang="ts">
defineProps<{ html: string; firstLine?: number }>();
</script>

<template>
  <div
    class="code-lines"
    :class="{ numbered: firstLine !== undefined }"
    :style="{ counterReset: `line ${(firstLine ?? 1) - 1}` }"
    v-html="html"
  />
</template>

<style scoped>
.code-lines :deep(pre) {
  margin: 0;
  padding: 0;
  overflow-x: auto;
  background: transparent !important;
}

.code-lines :deep(code) {
  display: block;
  width: fit-content;
  min-width: 100%;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.7;
}

.code-lines :deep(.line) {
  display: block;
  min-height: 1.7em;
  padding: 0 20px;
  counter-increment: line;
}

.code-lines.numbered :deep(.line) {
  padding-left: 0;
}

.code-lines.numbered :deep(.line)::before {
  content: counter(line);
  display: inline-block;
  width: 2.5em;
  margin-right: 16px;
  text-align: right;
  color: var(--vp-c-text-3);
  opacity: 0.6;
  user-select: none;
}

.code-lines :deep(.line.emphasis) {
  background: var(--vp-code-line-highlight-color);
  box-shadow: inset 3px 0 0 var(--vp-c-brand-2);
}

.code-lines :deep(span) {
  color: var(--shiki-light);
}

.dark .code-lines :deep(span) {
  color: var(--shiki-dark);
}
</style>
