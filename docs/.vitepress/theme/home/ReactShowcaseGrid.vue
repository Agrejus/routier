<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { Root } from "react-dom/client";

const emit = defineEmits<{ ready: [] }>();

const host = ref<HTMLElement | null>(null);

let root: Root | null = null;
let disposed = false;

onMounted(async () => {
  const [{ createElement }, { createRoot }, { ShowcaseGrid }] = await Promise.all([
    import("react"),
    import("react-dom/client"),
    import("../../../_snippets/code/home/ShowcaseGrid"),
  ]);
  if (disposed || !host.value) return;

  root = createRoot(host.value);
  root.render(createElement(ShowcaseGrid, { onReady: () => emit("ready") }));
});

onBeforeUnmount(() => {
  disposed = true;
  root?.unmount();
});
</script>

<template>
  <div ref="host" class="react-host" />
</template>

<style scoped>
.react-host {
  display: contents;
}
</style>
