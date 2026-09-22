import type { IDbPlugin } from "@routier/core/plugins";
import { HashType, type SchemaId } from "@routier/core/schema";
import { CollectionBase } from "../collections/CollectionBase";
import { View } from "../views/View";
import { inspectionQueryable } from "./inspectionSource";
import type { QueryLog } from "./QueryLog";
import { toError } from "./toError";
import type {
    InspectedCollection,
    InspectedCount,
    InspectedPage,
    InspectedPageRequest,
    InspectedQuery,
    InspectedRow,
    StopWatching,
    StoreInspection,
} from "./types";

function readonlyCopies(collection: CollectionBase<{}>, rows: ReadonlyArray<{}>): ReadonlyArray<InspectedRow> {
    const { schema } = collection;
    return Object.freeze(rows.map(row => schema.freeze(schema.clone(row))));
}

function watchCount(collection: CollectionBase<{}>, onCount: (result: InspectedCount) => void): StopWatching {
    return collection[inspectionQueryable]().subscribe().count(result => {
        onCount(result.ok === "error"
            ? { status: "error", error: toError(result.error) }
            : { status: "success", count: result.data });
    });
}

function watchPage(
    collection: CollectionBase<{}>,
    page: InspectedPageRequest,
    onRows: (result: InspectedPage) => void
): StopWatching {
    return collection[inspectionQueryable]().subscribe().skip(page.skip).take(page.take).toArray(result => {
        onRows(result.ok === "error"
            ? { status: "error", error: toError(result.error) }
            : { status: "success", rows: readonlyCopies(collection, result.data) });
    });
}

function inspectCollection(collection: CollectionBase<{}>): InspectedCollection {
    return Object.freeze({
        name: collection.schema.collectionName,
        schemaId: collection.schema.id,
        kind: collection instanceof View ? "view" : "collection",
        count: () => collection[inspectionQueryable]().countAsync(),
        keyOf: (row: InspectedRow) => collection.schema.hash(row, HashType.Ids),
        watchCount: (onCount: (result: InspectedCount) => void) => watchCount(collection, onCount),
        watchPage: (page: InspectedPageRequest, onRows: (result: InspectedPage) => void) =>
            watchPage(collection, page, onRows),
    });
}

export function inspectStore(
    plugin: IDbPlugin,
    collections: ReadonlyMap<SchemaId, CollectionBase<{}>>,
    disposed: AbortSignal,
    queryLog: QueryLog
): StoreInspection {
    return Object.freeze({
        plugin: Object.freeze({ name: plugin.constructor.name, databaseName: plugin.databaseName }),
        collections: Object.freeze([...collections.values()].map(inspectCollection)),
        disposed,
        watchQueries: (onQuery: (query: InspectedQuery) => void) => queryLog.watch(onQuery),
    });
}
