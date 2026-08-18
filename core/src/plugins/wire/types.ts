import { SerializedExpression } from "../../expressions";
import { JoinKind } from "../query/join";
import { ExecutedQuery } from "../query/explain";
import { QueryOrdering } from "../query/types";

/**
 * The wire format for a whole Routier operation.
 *
 * This is what makes a plugin that owns no database possible: the query itself travels, and a
 * receiver executes it against whatever plugin IT has. Nothing here is HTTP-specific — it is plain
 * JSON, so the same payload works over fetch, a WebSocket, a worker `postMessage`, or a queue.
 *
 * ## Two rules shape every type below
 *
 * 1. **No functions cross.** A query option carries live closures — a sort selector, a filter
 *    predicate, a map projection — and none of them survive `JSON.stringify`. Where a closure can
 *    be REBUILT from data it is dropped and reconstructed on arrival (a sort selector from its
 *    property, a filter predicate from its expression tree). Where it cannot, the option does not
 *    travel at all and the sender runs it locally; see `map` and `group`.
 * 2. **The receiver's schema is the authority.** Collections are named, never described. A payload
 *    says "teams", and the receiver resolves its own compiled schema for that name. Sending a
 *    schema would let the sender decide what its properties are, which is backwards for anything
 *    crossing a trust boundary — and it is the same reason `expressionFromJson` takes the schema
 *    rather than reading an id out of the payload.
 */

/** A query option, in the form that survives a wire. */
export type SerializedQueryOption =
    | { name: "skip"; value: number }
    | { name: "take"; value: number }
    /** The selector is dropped and rebuilt from the property on arrival. */
    | { name: "sort"; value: { propertyName: string; direction: QueryOrdering } }
    /**
     * The expression only — no closure and no params bag.
     *
     * A filter reaching a query option is already BOUND: `ParamReferenceExpression` never escapes
     * the parser, so every param value is already a literal in the tree. The receiver rebuilds a
     * runnable predicate from the tree with `toStrictPredicate`.
     */
    | { name: "filter"; value: { expression: SerializedExpression } }
    | { name: "nearest"; value: { propertyName: string; vector: number[]; count: number } }
    | {
        name: "join";
        value: {
            kind: JoinKind;
            /** Named, not described — the receiver resolves its own schema for it. */
            innerCollectionName: string;
            outerKeyPath: string;
            innerKeyPath: string;
            innerOptions: SerializedQueryOption[];
            semiJoinKeyThreshold: number;
        };
    }
    | { name: "count" | "min" | "max" | "sum" | "distinct"; value: true };

export type SerializedQueryRequest = {
    kind: "query";
    collectionName: string;
    options: SerializedQueryOption[];
    /**
     * Whether the caller wants the response to say what the server ran. Required — a query is
     * either explained or it is not. A server whose plugin does not report answers `true` the
     * same as `false`, and the caller's explanation marks the remote step as not reported.
     */
    explain: boolean;
};

/** One entity update, as `EntityUpdateInfo` minus nothing — every field of it is already JSON. */
export type SerializedUpdate = {
    entity: unknown;
    changeType: "propertiesChanged" | "markedDirty" | "notModified";
    delta: unknown;
    concurrency?: { column: string; expected: number };
};

export type SerializedSchemaChanges = {
    collectionName: string;
    adds: unknown[];
    updates: SerializedUpdate[];
    removes: unknown[];
};

export type SerializedPersistRequest = {
    kind: "persist";
    changes: SerializedSchemaChanges[];
};

export type SerializedDestroyRequest = {
    kind: "destroy";
};

export type SerializedRequest = SerializedQueryRequest | SerializedPersistRequest | SerializedDestroyRequest;

/** What a receiver sends back. Errors are a value, not a transport status. */
export type SerializedResponse =
    /**
     * `executedQueries` carries what the SERVER's plugin ran, so `.explain()` on a client sees
     * through the wire rather than reporting a blank. Optional on the response, unlike on a
     * local event: a plugin that does not report has nothing to send, and the client's
     * explanation then marks the remote step as not reported. There is no flag on either end —
     * the wire forwards whatever the plugin pushed, or nothing.
     */
    | { ok: true; kind: "query"; value: unknown; executedQueries?: ExecutedQuery[] }
    | { ok: true; kind: "persist"; changes: Array<{ collectionName: string; adds: unknown[]; updates: unknown[]; removes: unknown[] }> }
    | { ok: true; kind: "destroy" }
    | { ok: false; error: string };
