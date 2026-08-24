import { defineConfig } from "vitepress";
import sidebar from "./sidebar.json";

export default defineConfig({
  title: "Routier",
  description:
    "Modern, flexible, reactive data access layer for building scalable applications",
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: "https://routier.dev" },
  // TypeDoc emits these extensionless directory links for a few type-only symbols.
  // VitePress reports them even though they are absent from the generated Markdown.
  ignoreDeadLinks: [/^\.\/index$/, /^\.\/type-aliases\/index$/],
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
      {
        text: "Plugins",
        items: [
          { text: "Overview & Plugin Picker", link: "/integrations/plugins/built-in-plugins/" },
          { text: "Storage Plugins", link: "/integrations/plugins/built-in-plugins/#choose-a-storage-plugin" },
          { text: "Wrapper Plugins", link: "/integrations/plugins/built-in-plugins/wrappers" },
          { text: "Replication & SWR", link: "/integrations/plugins/built-in-plugins/replication/README" },
          { text: "Files & Blob Storage", link: "/integrations/plugins/built-in-plugins/files" },
          { text: "S3 & SaaS Blob Storage", link: "/integrations/plugins/built-in-plugins/s3-blob-storage" },
          { text: "Encryption", link: "/integrations/plugins/built-in-plugins/encryption" },
          { text: "Build a Plugin", link: "/integrations/plugins/create-your-own/" },
        ],
      },
      { text: "Queries", link: "/concepts/queries/" },
      { text: "Concepts", link: "/concepts/" },
      { text: "Guides", link: "/guides/" },
      { text: "React", link: "/integrations/react/" },
      { text: "API", link: "/api/" },
      // target forces a full-page load instead of VitePress client routing: /lab/ is a
      // standalone React application copied into the Pages artifact.
      { text: "Lab", link: "/lab/", target: "_self" },
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
