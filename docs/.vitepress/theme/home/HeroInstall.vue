<script setup lang="ts">
import InstallCommand from "./InstallCommand.vue";
import { INSTALL_COMMAND } from "./install";
</script>

<template>
  <div class="hero-install">
    <InstallCommand :command="INSTALL_COMMAND" />
  </div>
</template>

<style scoped>
.hero-install {
  display: flex;
  justify-content: center;
  padding-top: 24px;
}

@media (min-width: 960px) {
  .hero-install {
    justify-content: flex-start;
    width: max-content;
  }
}
</style>
