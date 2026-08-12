import type { CompiledSchema } from "@routier/core/schema";

/**
 * The one thing this plugin demands of a schema: an `_id` key it can hand straight to Mongo.
 *
 * Mongo reserves `_id` and gives every document one whether the schema asked for it or not.
 * That leaves three ways to reconcile a Routier key with it, and two of them are traps:
 *
 * - Synthesise an `_id` and keep the schema's key as a normal field. Every document then
 *   carries two identifiers that must not disagree, plus a unique index nobody declared.
 * - Map whatever the key is called onto `_id` silently. Renames become invisible, and a
 *   composite key has to be encoded into one value, which is a format the caller never sees
 *   but has to live with forever.
 * - Require the schema to say `_id`. One identifier, no encoding, and the caller knows what
 *   the document looks like.
 *
 * The third is what this does. It throws rather than adapts, at schema time, so it fails when
 * a store is built rather than on the first save.
 */

/** Validated once per schema — the check is pure and the answer cannot change. */
const checked = new WeakSet<object>();

export function assertMongoSchema<T extends {}>(schema: CompiledSchema<T>): void {
    if (checked.has(schema as unknown as object)) {
        return;
    }

    const ids = schema.idProperties;
    const where = `Collection '${schema.collectionName}'`;

    // No check for a missing key: `SchemaDefinition.compile` already refuses one, with a
    // message that names the fix. Repeating it here would be unreachable.

    if (ids.length > 1) {
        const names = ids.map(property => property.name).join(", ");

        throw new Error(
            `${where} declares a composite key (${names}). MongoDB documents have exactly one ` +
            `identifier, and encoding several into it would invent a format you would then be ` +
            `stuck with. Use a single \`_id: s.string().key().identity()\` and keep ` +
            `${names} as ordinary indexed properties.`
        );
    }

    const [id] = ids;

    /**
     * The DECLARED name, not the stored one — `.from('_id')` is rejected too.
     *
     * That looks over-strict, since the stored document would be identical. It is not, and
     * the reason is in `QueryOptionsCollection`: a filter touching any renamed property is
     * routed to the memory execution target, because filter selectors use in-memory names
     * and only deserialized entities have them. So with a renamed key, `where(x => x.id ===
     * '…')` never reaches Mongo — the plugin fetches the whole collection and matches in
     * JavaScript.
     *
     * A rename would therefore turn the single most common query there is into a full scan,
     * silently, and the document would look correct the whole time. Rejecting it is cheaper
     * than explaining it later.
     */
    if (id.name !== "_id") {
        const via = id.getResolvedName() === "_id" ? ` (renamed with .from('_id'))` : "";

        throw new Error(
            `${where} uses '${id.name}'${via} as its key. It has to be DECLARED \`_id\`. ` +
            `MongoDB reserves '_id' and assigns one regardless, so a second identifier would ` +
            `have to be kept in step with it — and a renamed key is worse than it looks: core ` +
            `routes filters on renamed properties to in-memory evaluation, so every lookup by ` +
            `id would fetch the entire collection. Declare \`_id: s.string().key().identity()\`.`
        );
    }

    /**
     * `_id` may be declared with OR without `.identity()`, and both are safe.
     *
     * This used to require `.identity()`, on the grounds that Mongo fills in a missing `_id`
     * and the change tracker could not match a value it never issued. That reasoning only
     * covers a key nobody supplies — and in Routier a key without `.identity()` is BY
     * DEFINITION one the caller supplies, so Mongo never has to invent it. The rule was
     * therefore stricter than the database and rejected a schema that works.
     *
     * Relaxed for the generated full-text search index, whose key is
     * `${term}|${field}|${sourceId}` — built by index maintenance, never assigned, and never
     * expressible as an identity. Ordinary caller-keyed schemas gain the same freedom.
     */
    checked.add(schema as unknown as object);
}
