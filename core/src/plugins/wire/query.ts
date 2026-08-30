import { Expression, foldConstantCalls, toStrictPredicate } from "../../expressions";
import { CompiledSchema } from "../../schema";
import { UnknownRecord } from "../../utilities";
import { JoinKeyReference } from "../query/join";
import { QueryOptionsCollection } from "../query/QueryOptionsCollection";
import { QueryOptionName, QueryOrdering } from "../query/types";
import { SerializedQueryOption } from "./types";

/**
 * Which options can cross a wire, and how the rest are handled.
 *
 * Everything except `map` and `group`. Those two are defined BY a closure — the projection is the
 * option — and no data form of them exists to send. Nothing else needs its closure: a sort is a
 * property and a direction, a filter is an expression tree, `nearest` is a vector and a count.
 */
const SENDABLE: ReadonlySet<QueryOptionName> = new Set<QueryOptionName>([
    "skip", "take", "sort", "filter", "nearest", "join", "count", "min", "max", "sum", "distinct"
]);

/**
 * Splits options into the PREFIX that can be sent and the remainder that cannot.
 *
 * A prefix, not a filtered subset, and that is the whole correctness argument. Options are ordered,
 * and most are not idempotent: sending `count` while keeping `map` local would count unmapped rows,
 * and applying `take` on both sides would window twice. So the split stops at the first option that
 * cannot travel, and everything from there on runs where the closures are.
 *
 * It is the same shape as the database/memory split this composes with — one more cut of the same
 * ordered list, for one more reason.
 */
export const splitSendableOptions = <T>(options: QueryOptionsCollection<T>): {
    sendable: QueryOptionsCollection<T>;
    local: QueryOptionsCollection<T>;
} => {
    const sendable = new QueryOptionsCollection<T>();
    const local = new QueryOptionsCollection<T>();

    let stopped = false;

    options.forEach(option => {
        if (stopped === false && SENDABLE.has(option.name) === false) {
            stopped = true;
        }

        (stopped ? local : sendable).add(option.name, option.value);
    });

    return { sendable, local };
};

/** The key's property path, which is what the receiver resolves against its own schema. */
const keyPath = (reference: JoinKeyReference) => reference.property?.id ?? reference.propertyName;

export const serializeQueryOptions = <T>(options: QueryOptionsCollection<T>): SerializedQueryOption[] => {
    const serialized: SerializedQueryOption[] = [];

    options.forEach(option => {
        const value = option.value as never as UnknownRecord;

        switch (option.name) {
            case "skip":
            case "take":
                serialized.push({ name: option.name, value: option.value as never as number });
                return;

            case "sort":
                serialized.push({
                    name: "sort",
                    value: {
                        // The declared path, so the receiver can resolve its own property and rebuild
                        // both the selector and the storage column name from it
                        propertyName: (value.property as { id?: string } | null)?.id ?? String(value.propertyName),
                        direction: value.direction as QueryOrdering
                    }
                });
                return;

            case "filter": {
                const expression = value.expression as never as Expression;

                /**
                 * A filter with no usable tree must not be SENT, and this is a hard error.
                 *
                 * `not-parsable` means the intent is unknown — the parser could not work out what the
                 * predicate asks for. A receiver handed that has two options, and both are wrong: read
                 * everything (returning rows the caller excluded) or return nothing (silently losing
                 * them). Neither is a degradation worth accepting when the caller's own closure is
                 * sitting right here and can answer correctly.
                 *
                 * In practice this is unreachable: `QueryOptionsCollection.add` targets an unparsable
                 * filter at the MEMORY half, so it never reaches a plugin. The guard is here because
                 * "unreachable" is a property of code that changes, and the failure it would let
                 * through is silent.
                 */
                if (Expression.isNotParsable(expression)) {
                    throw new Error(
                        "Cannot send a filter whose expression could not be parsed: the receiver would have to guess whether to " +
                        "return everything or nothing, and both answers are wrong.  A filter like this belongs in the memory half, " +
                        "where the caller's own predicate runs."
                    );
                }

                serialized.push({ name: "filter", value: { expression: Expression.toJson(expression) } });
                return;
            }

            case "nearest":
                serialized.push({
                    name: "nearest",
                    value: {
                        propertyName: (value.property as { id?: string } | null)?.id ?? String(value.propertyName),
                        vector: value.vector as number[],
                        count: value.count as number
                    }
                });
                return;

            case "join": {
                const join = value as never as {
                    kind: "inner" | "left";
                    innerOptions: QueryOptionsCollection<unknown>;
                    outerKey: JoinKeyReference;
                    innerKey: JoinKeyReference;
                    semiJoinKeyThreshold: number;
                    innerCollectionName?: string;
                };

                serialized.push({
                    name: "join",
                    value: {
                        kind: join.kind,
                        // Resolved by the caller, which is the only place that can see the schema
                        // collection the id refers to
                        innerCollectionName: join.innerCollectionName ?? "",
                        outerKeyPath: keyPath(join.outerKey),
                        innerKeyPath: keyPath(join.innerKey),
                        innerOptions: serializeQueryOptions(join.innerOptions),
                        semiJoinKeyThreshold: join.semiJoinKeyThreshold
                    }
                });
                return;
            }

            case "count":
            case "min":
            case "max":
            case "sum":
            case "distinct":
                serialized.push({ name: option.name, value: true });
                return;

            default:
                throw new Error(
                    `Cannot serialize the '${option.name}' query option: it is defined by a function, which cannot cross a wire.  ` +
                    `Use splitSendableOptions so it runs where its closure is.`
                );
        }
    });

    return serialized;
};

/** How the receiver finds a collection it was sent the NAME of. */
export type SchemaResolver = (collectionName: string) => CompiledSchema<any> | null;

/**
 * A filter the RECEIVER adds to every read of a collection, whatever the sender asked for.
 *
 * Returns `null` for a collection with nothing to add. See `createRequestHandler` for the policy
 * side; this is only how it reaches the options.
 */
export type ScopeProvider = (schema: CompiledSchema<any>) => Expression | null;

/**
 * Rebuilds query options from their wire form, against the receiver's own schemas.
 *
 * The closures that were dropped are reconstructed here rather than sent:
 *
 * - a **sort selector** from its property, which is all `JsonTranslator.sort` reads;
 * - a **filter predicate** from its expression tree, via `toStrictPredicate` — which THROWS rather
 *   than keeping a row it cannot judge, because on a receiver a filter that quietly stops filtering
 *   returns rows the requester excluded.
 *
 * @throws when a named property or collection is not declared by the receiver's schemas. A payload
 * describing data this side does not have is a disagreement, and it has to be loud.
 */
export const deserializeQueryOptions = (
    serialized: SerializedQueryOption[],
    schema: CompiledSchema<any>,
    resolveSchema: SchemaResolver,
    /**
     * A receiver-side filter per collection, applied to this collection AND to every collection a
     * join reaches. Prepended, so it is ANDed with whatever the sender sent and there is no order of
     * options that removes it.
     */
    scopeFor?: ScopeProvider
): QueryOptionsCollection<any> => {

    const options = new QueryOptionsCollection<any>();

    /**
     * FIRST, before anything the sender asked for.
     *
     * Position matters twice. It cannot be displaced by any option the sender chose, and being at
     * the front it is in the database half — so a backend pushes it down rather than the receiver
     * reading the whole collection and filtering afterwards.
     */
    const scope = scopeFor?.(schema) ?? null;

    if (scope != null) {
        options.add("filter", {
            filter: toStrictPredicate(scope) as never,
            expression: scope,
            params: undefined
        } as never);
    }

    const propertyOf = (path: string) => {
        const property = schema.getProperty(path);

        if (property == null) {
            throw new Error(
                `Cannot deserialize a query: this schema does not declare the property it names.  ` +
                `Property: ${path}, Collection: ${schema.collectionName}`
            );
        }

        return property;
    };

    for (const option of serialized) {
        switch (option.name) {
            case "skip":
            case "take":
                options.add(option.name, option.value as never);
                break;

            case "sort": {
                const property = propertyOf(option.value.propertyName);

                options.add("sort", {
                    selector: ((row: UnknownRecord) => property.getValue(row)) as never,
                    direction: option.value.direction,
                    propertyName: option.value.propertyName,
                    property
                } as never);
                break;
            }

            case "filter": {
                const expression = foldConstantCalls(Expression.fromJson(option.value.expression, schema));

                options.add("filter", {
                    filter: toStrictPredicate(expression) as never,
                    expression,
                    params: undefined
                } as never);
                break;
            }

            case "nearest": {
                const property = propertyOf(option.value.propertyName);

                options.add("nearest", {
                    selector: ((row: UnknownRecord) => property.getValue(row)) as never,
                    propertyName: option.value.propertyName,
                    property,
                    vector: option.value.vector,
                    count: option.value.count
                } as never);
                break;
            }

            case "join": {
                const innerSchema = resolveSchema(option.value.innerCollectionName);

                if (innerSchema == null) {
                    throw new Error(
                        `Cannot deserialize a join: this store has no collection named '${option.value.innerCollectionName}'.`
                    );
                }

                options.add("join", {
                    kind: option.value.kind,
                    innerSchemaId: innerSchema.id,
                    outerKey: { propertyName: option.value.outerKeyPath, property: propertyOf(option.value.outerKeyPath) },
                    innerKey: {
                        propertyName: option.value.innerKeyPath,
                        property: innerSchema.getProperty(option.value.innerKeyPath)
                    },
                    /**
                     * The inner side is deserialized with the SAME scope provider, which is what
                     * stops a join being a way around a scope: a sender that cannot read a
                     * collection directly must not be able to read it by joining to it.
                     */
                    innerOptions: deserializeQueryOptions(option.value.innerOptions, innerSchema, resolveSchema, scopeFor),
                    // False by construction: the receiver executes both sides against its own single
                    // plugin, whatever the sender's topology was.
                    crossPlugin: false,
                    semiJoinKeyThreshold: option.value.semiJoinKeyThreshold
                } as never);
                break;
            }

            default:
                options.add(option.name, true as never);
                break;
        }
    }

    return options;
};
