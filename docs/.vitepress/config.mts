import { defineConfig } from "vitepress";
import sidebar from "./sidebar.json";
import { isIndexable, pageHead, SITE_DESCRIPTION, SITE_NAME, SITE_URL, siteHead } from "./seo";

export default defineConfig({
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  cleanUrls: true,
  vite: {
    esbuild: { jsx: "automatic", keepNames: true },
    resolve: { dedupe: ["react", "react-dom", "vue"] },
  },
  lastUpdated: true,
  sitemap: {
    hostname: SITE_URL,
    transformItems: (items) => items.filter((item) => isIndexable(item.url)),
  },
  // TypeDoc emits these extensionless directory links for a few type-only symbols.
  // VitePress reports them even though they are absent from the generated Markdown.
  ignoreDeadLinks: [/^\.\/index$/, /^\.\/type-aliases\/index$/],
  head: siteHead(),
  transformPageData: (pageData) => {
    pageData.frontmatter.head = [
      ...(pageData.frontmatter.head ?? []),
      ...pageHead(pageData),
    ];
  },
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
      {
        text: "Frameworks",
        items: [
          {
            text: "Frameworks",
            items: [
              { text: "React", link: "/integrations/react/" },
              { text: "Vue", link: "/integrations/vue/" },
            ],
          },
          { text: "Tools", items: [{ text: "Devtools", link: "/integrations/devtools/" }] },
        ],
      },
      { text: "API", link: "/api/" },
      // target forces a full-page load instead of VitePress client routing: /playground/ and
      // /lab/ are standalone React applications copied into the Pages artifact.
      { text: "Playground", link: "/playground/", target: "_self" },
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
