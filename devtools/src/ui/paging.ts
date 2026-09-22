import { PAGE_SIZE } from "../live/useLivePage";

export function hasNextPage(skip: number, count: number): boolean {
  return skip + PAGE_SIZE < count;
}

export function lastPageStart(count: number): number {
  return Math.max(0, Math.floor((count - 1) / PAGE_SIZE) * PAGE_SIZE);
}

export function describeRange(skip: number, count: number): string {
  if (count === 0) return "0 rows";
  return `${skip + 1}–${Math.min(skip + PAGE_SIZE, count)} of ${count}`;
}
