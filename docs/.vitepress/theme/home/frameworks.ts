export const FRAMEWORKS = ["react", "vue"] as const;

export type Framework = (typeof FRAMEWORKS)[number];

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  react: "React",
  vue: "Vue",
};
