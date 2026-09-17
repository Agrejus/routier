import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import PaginationShowcase from "./home/PaginationShowcase.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  // The home layout has no content slot between the hero and the feature cards,
  // so the live pagination showcase goes in through the theme's layout slot.
  Layout: () => h(DefaultTheme.Layout, null, { "home-features-before": () => h(PaginationShowcase) }),
};
