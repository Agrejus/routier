import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import FeaturesIntro from "./home/FeaturesIntro.vue";
import HeroInstall from "./home/HeroInstall.vue";
import NextSteps from "./home/NextSteps.vue";
import PaginationShowcase from "./home/PaginationShowcase.vue";
import StackFit from "./home/StackFit.vue";
import StorageSwap from "./home/StorageSwap.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "home-hero-actions-after": () => h(HeroInstall),
      "home-features-before": () => [h(PaginationShowcase), h(FeaturesIntro)],
      "home-features-after": () => [h(StorageSwap), h(StackFit), h(NextSteps)],
    }),
};
