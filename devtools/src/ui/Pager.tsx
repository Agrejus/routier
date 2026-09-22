import type { LiveState } from "../live/liveState";
import { PAGE_SIZE } from "../live/useLivePage";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { describeRange, hasNextPage } from "./paging";

interface PagerProps {
  skip: number;
  count: LiveState<number>;
  pageIsFull: boolean;
  onPage: (skip: number) => void;
}

export function Pager({ skip, count, pageIsFull, onPage }: PagerProps) {
  const canGoNext = count.status === "success" ? hasNextPage(skip, count.value) : pageIsFull;

  return (
    <div class="pager">
      <span class="range" aria-live="polite">
        {count.status === "success" ? describeRange(skip, count.value) : ""}
      </span>
      <button type="button" class="pager-button" disabled={skip === 0} onClick={() => onPage(Math.max(0, skip - PAGE_SIZE))}>
        <ChevronLeftIcon size={14} />
        Previous
      </button>
      <button type="button" class="pager-button" disabled={!canGoNext} onClick={() => onPage(skip + PAGE_SIZE)}>
        Next
        <ChevronRightIcon size={14} />
      </button>
    </div>
  );
}
