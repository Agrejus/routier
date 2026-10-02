import type { SchemaId } from "@routier/core/schema";
import type { InspectedCollection, StopWatching } from "@routier/datastore";
import type { LiveState } from "./liveState";
import { watchSafely } from "./watchSafely";

export type LiveCounts = ReadonlyMap<SchemaId, LiveState<number>>;

export function watchCount(collection: InspectedCollection, show: (state: LiveState<number>) => void): StopWatching {
  return watchSafely<number>(
    (deliver) =>
      collection.watchCount((result) =>
        deliver(result.status === "success" ? { status: "success", value: result.count } : result),
      ),
    `count of ${collection.name}`,
    show,
  );
}
