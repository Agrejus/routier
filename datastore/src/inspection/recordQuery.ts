import type { QueryExplanation } from "@routier/core/plugins";
import type { ResultType } from "@routier/core/results";
import { INSPECTION_SOURCE } from "./inspectionSource";
import type { QueryLog } from "./QueryLog";
import { toError } from "./toError";

export interface RecordedRequest {
    readonly collection: string;
    readonly source: string;
    readonly live: boolean;
    readonly explain: () => QueryExplanation;
}

export function createQueryRecorder(log: QueryLog, request: RecordedRequest) {
    const startedAt = performance.now();
    let delivered = false;

    return <T>(result: ResultType<T>): void => {
        const durationMs = delivered ? null : performance.now() - startedAt;
        delivered = true;
        if (!log.recording || request.source === INSPECTION_SOURCE) return;
        log.publish({
            collection: request.collection,
            live: request.live,
            at: Date.now(),
            durationMs,
            outcome: result.ok === "error" ? { status: "error", error: toError(result.error) } : { status: "success" },
            explanation: request.explain(),
        });
    };
}
