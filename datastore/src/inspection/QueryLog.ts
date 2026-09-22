import { logger } from "@routier/core/utilities";
import type { InspectedQuery, StopWatching } from "./types";

export type QueryLogEntry = Omit<InspectedQuery, "sequence">;

export class QueryLog {
    private readonly listeners = new Set<(query: InspectedQuery) => void>();
    private sequence = 0;

    get recording(): boolean {
        return this.listeners.size > 0;
    }

    watch(listener: (query: InspectedQuery) => void): StopWatching {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    publish(entry: QueryLogEntry): void {
        this.sequence++;
        const query: InspectedQuery = Object.freeze({ ...entry, sequence: this.sequence });
        for (const listener of this.listeners) {
            try {
                listener(query);
            } catch (error) {
                logger.error("A query watcher threw; the query itself was unaffected.", error);
            }
        }
    }
}
