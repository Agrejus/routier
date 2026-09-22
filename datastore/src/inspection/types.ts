import type { QueryExplanation } from "@routier/core/plugins";
import type { SchemaId } from "@routier/core/schema";

export type InspectedCollectionKind = "collection" | "view";

export type InspectedValue = string | number | bigint | boolean | symbol | null | undefined | object;

export type InspectedRow = Readonly<Record<string, InspectedValue>>;

export type InspectedPage =
    | { readonly status: "success"; readonly rows: ReadonlyArray<InspectedRow> }
    | { readonly status: "error"; readonly error: Error };

export type InspectedCount =
    | { readonly status: "success"; readonly count: number }
    | { readonly status: "error"; readonly error: Error };

export interface InspectedPageRequest {
    readonly skip: number;
    readonly take: number;
}

export type StopWatching = () => void;

export interface InspectedCollection {
    readonly name: string;
    readonly schemaId: SchemaId;
    readonly kind: InspectedCollectionKind;
    count(): Promise<number>;
    keyOf(row: InspectedRow): string;
    watchCount(onCount: (result: InspectedCount) => void): StopWatching;
    watchPage(page: InspectedPageRequest, onRows: (result: InspectedPage) => void): StopWatching;
}

export type InspectedQueryOutcome =
    | { readonly status: "success" }
    | { readonly status: "error"; readonly error: Error };

export interface InspectedQuery {
    readonly sequence: number;
    readonly collection: string;
    readonly live: boolean;
    readonly at: number;
    readonly durationMs: number | null;
    readonly outcome: InspectedQueryOutcome;
    readonly explanation: QueryExplanation;
}

export interface InspectedPlugin {
    readonly name: string;
    readonly databaseName: string;
}

export interface StoreInspection {
    readonly plugin: InspectedPlugin;
    readonly collections: ReadonlyArray<InspectedCollection>;
    readonly disposed: AbortSignal;
    watchQueries(onQuery: (query: InspectedQuery) => void): StopWatching;
}
