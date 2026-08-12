import { JoinKeyReference } from "@routier/core/plugins";
import { CompiledSchema, SchemaTypes } from "@routier/core/schema";
import { GenericFunction } from "@routier/core/types";

/**
 * A single property path and nothing else: `p._id`, `m.player.id`.
 *
 * No call, no operator, no object literal. The join algorithm needs the key VALUE, so anything
 * that is not a path has nothing to read — and a predicate would make the join a nested loop
 * over an arbitrary condition rather than the O(n + m) hash join the whole design rests on.
 */
const SINGLE_PROPERTY_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/;

/**
 * Key properties must be `string` or `number`.
 *
 * Hash-join keying needs a value that can be a `Map` key, and cross-backend equality needs one
 * that compares the same way everywhere. A `Date` is the reason this is a rule rather than a
 * convention: it compares by REFERENCE in JS and by VALUE in SQL, so a `Date`-keyed join would
 * return no pairs in memory and every correct pair on PostgreSQL — the same query, two answers.
 */
const KEYABLE_TYPES = new Set<SchemaTypes>([SchemaTypes.String, SchemaTypes.Number]);

/**
 * Resolves one side's key selector into a property path plus its `PropertyInfo`.
 *
 * Every failure here throws at QUERY BUILD time, where the selector is written, rather than at
 * execution — a join with an unusable key has no partially-correct behaviour to fall back to.
 *
 * @param side Which side of the join, so the message says which selector is wrong.
 */
export const resolveJoinKey = <TEntity extends {}>(
    side: "outer" | "inner",
    schema: CompiledSchema<TEntity>,
    selector: GenericFunction<any, any>
): JoinKeyReference => {

    const stringified = selector.toString();
    const arrowIndex = stringified.indexOf("=>");

    if (arrowIndex < 0) {
        throw new Error(`Only arrow functions are allowed in a join key selector.  Side: ${side}`);
    }

    const body = stringified.substring(arrowIndex + 2).trim();

    if (SINGLE_PROPERTY_PATH.test(body) === false) {
        throw new Error(
            `A join key selector must be a single property path.  Side: ${side}, Received: ${body}.  ` +
            `Conditions other than key equality belong in .where() after the join, where they run over the tuples.`
        );
    }

    const [, ...path] = body.split(".");
    const propertyName = path.join(".");
    const property = schema.getProperty(propertyName);

    if (property == null) {
        throw new Error(
            `A join key selector names a property the schema does not declare.  ` +
            `Side: ${side}, Property: ${propertyName}, Collection: ${schema.collectionName}`
        );
    }

    if (KEYABLE_TYPES.has(property.type) === false) {
        throw new Error(
            `A join key must be a string or number property.  ` +
            `Side: ${side}, Property: ${propertyName}, Type: ${property.type}.  ` +
            `Other types do not compare identically in memory and in SQL, so the same join would return different pairs per backend.`
        );
    }

    return { propertyName, property };
};
