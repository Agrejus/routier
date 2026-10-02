export type EtagValue = number | string;

export type EtagMode = "generate" | "keep";

export type EtagComparator<T> = (prev: T, next: T) => number;
