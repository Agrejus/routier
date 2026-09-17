<script setup lang="ts">
import { computed, onMounted, ref, watch, watchEffect } from "vue";
import { useQuery } from "@routier/vue";
import ProductGrid from "./ProductGrid.vue";
import { store } from "./inventory";
import { addRandomProduct, seedOnce, simulateTraffic } from "./inventorySimulation";

const emit = defineEmits<{ ready: [] }>();

const traffic = ref(false);
const loaded = useQuery<number>(onResult => store.products.subscribe().count(onResult));
const ready = computed(() => loaded.value.status === "success" && loaded.value.data > 0);

onMounted(() => void seedOnce());

watch(
  ready,
  isReady => {
    if (isReady) emit("ready");
  },
  { immediate: true },
);

watchEffect(onCleanup => {
  if (!traffic.value) return;
  const timer = setInterval(() => void simulateTraffic(), 900);
  onCleanup(() => clearInterval(timer));
});
</script>

<template>
  <div class="grid-bar">
    <span class="grid-title">Inventory</span>
    <span :class="ready ? 'live is-ready' : 'live'">
      <span class="dot" />
      live
    </span>
    <span class="spacer" />
    <button type="button" class="chip" :disabled="!ready" @click="addRandomProduct">+ Add</button>
    <button
      type="button"
      :class="traffic ? 'chip is-on' : 'chip'"
      :aria-pressed="traffic"
      :disabled="!ready"
      @click="traffic = !traffic"
    >
      {{ traffic ? "■ Stop traffic" : "▶ Traffic" }}
    </button>
  </div>
  <div class="grid-body">
    <ProductGrid />
  </div>
</template>
