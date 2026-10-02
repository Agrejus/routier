import { useEffect, useState } from "preact/hooks";
import type { InspectedCollection, InspectedRow } from "@routier/datastore";
import type { FrameScheduler } from "./frameScheduler";
import { loadingState, type LiveState } from "./liveState";
import { watchSafely } from "./watchSafely";

export const PAGE_SIZE = 50;

export type LivePage = LiveState<ReadonlyArray<InspectedRow>>;

export function useLivePage(collection: InspectedCollection, skip: number, scheduler: FrameScheduler): LivePage {
  const [page, setPage] = useState<LivePage>(loadingState);

  useEffect(() => {
    let active = true;
    setPage(loadingState);
    const stop = watchSafely<ReadonlyArray<InspectedRow>>(
      (deliver) =>
        collection.watchPage({ skip, take: PAGE_SIZE }, (result) =>
          deliver(result.status === "success" ? { status: "success", value: result.rows } : result),
        ),
      `rows of ${collection.name}`,
      (state) =>
        scheduler.schedule(() => {
          if (active) setPage(state);
        }),
    );
    return () => {
      active = false;
      stop();
    };
  }, [collection, skip, scheduler]);

  return page;
}
