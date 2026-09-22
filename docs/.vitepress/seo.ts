import type { HeadConfig } from "vitepress";

type SeoFrontmatter = {
  title?: string;
  titleTemplate?: string;
  description?: string;
  head?: HeadConfig[];
};

type SeoPage = {
  relativePath: string;
  title?: string;
  description?: string;
  frontmatter: SeoFrontmatter;
};

export const SITE_URL = "https://routier.dev";

export const SITE_NAME = "Routier";

export const SITE_DESCRIPTION =
  "Routier is a TypeScript data layer for front-end apps: schemas, live queries, optimistic mutations, and swappable storage plugins for IndexedDB, SQLite, PostgreSQL and more.";

const OG_IMAGE = `${SITE_URL}/og-image.png`;

const UNINDEXED_PATHS = ["README", "CONTRIBUTING", "mutation-backlog", "known-issues"];

const normalizePath = (path: string): string => path.replace(/^\//, "").replace(/\/$/, "");

export const canonicalUrl = (relativePath: string): string => {
  const path = relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");

  return path.length === 0 ? `${SITE_URL}/` : `${SITE_URL}/${path}`;
};

export const isIndexable = (pathOrUrl: string): boolean => {
  const path = normalizePath(pathOrUrl.replace(SITE_URL, ""));
  const segments = path.split("/").map((segment) => segment.replace(/\.(md|html)$/, ""));

  return !segments.some((segment) => UNINDEXED_PATHS.includes(segment));
};

export const siteHead = (): HeadConfig[] => [
  ["link", { rel: "icon", type: "image/svg+xml", href: "/routier.svg" }],
  ["meta", { name: "theme-color", content: "#00bfa6" }],
  ["meta", { property: "og:type", content: "website" }],
  ["meta", { property: "og:site_name", content: SITE_NAME }],
  ["meta", { property: "og:image", content: OG_IMAGE }],
  ["meta", { property: "og:image:width", content: "1200" }],
  ["meta", { property: "og:image:height", content: "630" }],
  [
    "meta",
    { property: "og:image:alt", content: "Routier — reactive data for any datastore" },
  ],
  ["meta", { name: "twitter:card", content: "summary_large_image" }],
  ["meta", { name: "twitter:image", content: OG_IMAGE }],
  [
    "script",
    { type: "application/ld+json" },
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      codeRepository: "https://github.com/Agrejus/routier",
      programmingLanguage: "TypeScript",
      license: "https://opensource.org/licenses/MIT",
    }),
  ],
];

const socialTitle = (page: SeoPage): string => {
  const title = page.frontmatter.title ?? page.title ?? SITE_NAME;
  const template = page.frontmatter.titleTemplate;

  if (template != null) {
    return `${title} | ${template}`;
  }

  return title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
};

export const pageHead = (page: SeoPage): HeadConfig[] => {
  const url = canonicalUrl(page.relativePath);
  const title = socialTitle(page);
  const description = page.frontmatter.description ?? page.description ?? SITE_DESCRIPTION;

  const head: HeadConfig[] = [
    ["link", { rel: "canonical", href: url }],
    ["meta", { property: "og:url", content: url }],
    ["meta", { property: "og:title", content: title }],
    ["meta", { property: "og:description", content: description }],
    ["meta", { name: "twitter:title", content: title }],
    ["meta", { name: "twitter:description", content: description }],
  ];

  if (!isIndexable(url)) {
    head.push(["meta", { name: "robots", content: "noindex, follow" }]);
  }

  return head;
};
