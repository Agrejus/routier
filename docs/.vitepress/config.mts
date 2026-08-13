import { defineConfig } from "vitepress";
import sidebar from "./sidebar.json";

export default defineConfig({
  title: "Routier",
  description:
    "Modern, flexible, reactive data access layer for building scalable applications",
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: "https://routier.dev" },
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/routier.svg" }],
    ["meta", { name: "theme-color", content: "#00bfa6" }],
    ["meta", { property: "og:title", content: "Routier" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "A fast, front-end-first data toolkit: schemas, live queries, optimistic mutations, and swappable storage plugins.",
      },
    ],
  ],
  themeConfig: {
    logo: "/routier.svg",
    nav: [
      { text: "Get Started", link: "/getting-started/installation" },
      { text: "Concepts", link: "/concepts/" },
      { text: "Guides", link: "/guides/" },
      { text: "React", link: "/integrations/react/" },
      { text: "Plugins", link: "/integrations/plugins/built-in-plugins/" },
    ],
    sidebar,
    search: { provider: "local" },
    socialLinks: [
      { icon: "github", link: "https://github.com/Agrejus/routier" },
      { icon: "npm", link: "https://www.npmjs.com/package/@routier/datastore" },
    ],
    editLink: {
      pattern: "https://github.com/Agrejus/routier/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © Routier contributors",
    },
    outline: { level: [2, 3] },
  },
});
