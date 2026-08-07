import { SchemaTypes } from '@routier/core/schema';
import type { CompiledSchema, PropertyInfo } from '@routier/core/schema';
import type {
    DbPluginBulkPersistEvent,
    DbPluginEvent,
    DbPluginQueryEvent,
    IDbPlugin,
    ITranslatedValue,
} from '@routier/core/plugins';
import { PluginEventResult, type PluginEventCallbackPartialResult, type PluginEventCallbackResult } from '@routier/core/results';
import type { BulkPersistResult, SchemaCollection } from '@routier/core/collections';
import { Query } from '@routier/core/plugins';
import { decrypt, encrypt, isEnvelope } from './cipher';
import { fromText, isEncryptable, toText } from './codec';
import type { Keyring } from './keyring';
import type { EncryptionMode } from '@routier/core/schema';

/**
 * Encrypts marked properties before they reach the database, and decrypts them on the way back.
 *
 * ```ts
 * class AppStore extends DataStore {
 *     users = this.collection(userSchema).proxy().create();
 *     constructor() {
 *         super(new EncryptionDbPlugin(new SqliteDbPlugin('app.db'), keyring));
 *     }
 * }
 * ```
 *
 * The inner plugin is entirely unaware. It stores strings, builds its own DDL, and runs its own
 * transactions; it never sees a plaintext value and needs no changes to work with this. That is
 * the point of writing it as a wrapper — one implementation covers every backend rather than
 * nine implementations covering one each.
 *
 * ## What it refuses to do
 *
 * A filter on a randomised property cannot run in the database, because the same value has a
 * different ciphertext every time. This throws rather than loading the table and filtering in
 * memory. A query that quietly becomes a full scan is the kind of thing that passes review, and
 * then passes staging, and is discovered in production.
 *
 * A filter on a **searchable** property runs, for equality only: the value in the filter is
 * encrypted deterministically and compared against the stored ciphertext, so the database uses
 * its index and never sees the plaintext. Ordering, ranges and `LIKE` are rejected — a
 * ciphertext does not sort like its plaintext, and a comparison that ran would return rows that
 * look right and are not.
 */
export class EncryptionDbPlugin implements IDbPlugin {

    /**
     * Ciphertexts produced while rewriting one filter, so the params rewrite reuses them
     * rather than encrypting the same value twice.
     */
    private readonly ciphertexts = new Map<string, string>();

    constructor(
        private readonly plugin: IDbPlugin,
        private readonly keyring: Keyring
    ) { }

    get identity(): string | undefined {
        return this.plugin.identity;
    }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        const properties = encryptedProperties(event.operation.schema);

        if (properties.length === 0) {
            this.plugin.query(event, done);
            return;
        }

        const viewed: DbPluginQueryEvent<TRoot, TShape> = {
            ...event,
            schemas: this.viewOfAll(event.schemas),
            operation: new Query<TRoot, TShape>(
                event.operation.options,
                this.viewOf(event.operation.schema),
                (event.operation as unknown as { enableChangeTrackingOverride?: boolean }).enableChangeTrackingOverride
            ),
        };

        this.prepareFilters(event, properties)
            .then(() => {
                this.plugin.query(viewed, result => {
                    if (result.ok === 'error') {
                        done(result);
                        return;
                    }

                    this.decryptResult(result.data, properties)
                        .then(() => done(result))
                        .catch(error => done(PluginEventResult.error(event.id, error)));
                });
            })
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.plugin.destroy(event, done);
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        const viewed: DbPluginBulkPersistEvent = {
            ...event,
            schemas: this.viewOfAll(event.schemas),
        };

        this.encryptChanges(event)
            .then(() => {
                this.plugin.bulkPersist(viewed, (result) => {
                    if (result.ok === 'error') {
                        done(result);
                        return;
                    }

                    // The echo carries ciphertext, and the change tracker compares it against
                    // what the entity holds. Decrypting it back keeps the two sides equal.
                    this.decryptPersistResult(event, result.data)
                        .then(() => done(result))
                        .catch(error => done(PluginEventResult.error(event.id, error)));
                });
            })
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }

    /**
     * The schema the inner plugin sees: encrypted properties typed as strings.
     *
     * A ciphertext is text, so an encrypted number cannot live in the column its own schema
     * would produce. Rather than teaching nine plugins about encryption, they are handed a
     * view of the compiled schema in which those properties say `String` — and every one of
     * them then builds a TEXT column, skips JSON encoding, and indexes it as a string,
     * through completely unmodified code.
     *
     * The same prototype-delegation technique as `ConcurrencyDbPlugin`, applied to REPLACING
     * a property rather than appending one. `Object.defineProperty` on the derived object is
     * what makes it safe: it defines an own property that shadows the original, so the real
     * `PropertyInfo` is untouched — and would stay untouched even if it were frozen, because
     * an assignment would throw there and this does not assign.
     */
    private readonly views = new Map<unknown, CompiledSchema<any>>();

    private viewOf<T extends {}>(schema: CompiledSchema<T>): CompiledSchema<T> {
        const cached = this.views.get(schema.id);

        if (cached != null) {
            return cached as CompiledSchema<T>;
        }

        const encrypted = new Set(encryptedProperties(schema).map(e => e.property.name));

        if (encrypted.size === 0) {
            return schema;
        }

        const view = Object.create(schema) as CompiledSchema<T>;

        /**
         * A property that becomes a string has no children, and its children must go with it.
         *
         * `profile: encrypted(s.object({ city, score }))` is one TEXT column holding a
         * ciphertext. Leaving `city` and `score` in the list left the plugin still trying to
         * rebuild a nested object from them, and it read them off the ciphertext string: the
         * whole property came back `undefined`, and the failure surfaced far away, in the
         * datastore's generated postprocess reading `.city` off nothing.
         */
        const isUnderEncrypted = (property: { name: string; parent?: unknown }) => {
            let current = property as { name: string; parent?: { name: string; parent?: unknown } } | undefined;

            while (current?.parent != null) {
                current = current.parent as typeof current;
            }

            return current != null && current !== property && encrypted.has(current.name);
        };

        Object.defineProperty(view, 'properties', {
            value: schema.properties
                .filter(property => isUnderEncrypted(property) === false)
                .map(property => {
                    if (property.parent != null || encrypted.has(property.name) === false) {
                        return property;
                    }

                    const asString = Object.create(property);

                    Object.defineProperty(asString, 'type', {
                        value: SchemaTypes.String,
                        enumerable: true,
                    });

                    return asString;
                }),
            enumerable: true,
        });

        /**
         * A deep copy, rather than the schema's generated `clone`.
         *
         * The generated one is built from the REAL schema and rebuilds a nested object from
         * the children it declares. An encrypted object has no children any more — it is one
         * ciphertext string — so it reconstructed the property from fields of a string and
         * produced `undefined`. The in-process plugin already reaches for `structuredClone`
         * when it cannot trust the generated clone; this is the same situation.
         */
        Object.defineProperty(view, 'clone', {
            value: (record: unknown) => structuredClone(record),
            enumerable: true,
        });

        this.views.set(schema.id, view);

        return view;
    }

    /** A SchemaCollection whose every schema is the view. */
    private viewOfAll(schemas: SchemaCollection): SchemaCollection {
        const viewOf = (schema: CompiledSchema<any>) => this.viewOf(schema);

        return new Proxy(schemas, {
            get(target, property, receiver) {
                if (property === 'get') {
                    return (id: never) =>
                        viewOf((target as unknown as { get(id: never): CompiledSchema<any> }).get(id));
                }

                return Reflect.get(target, property, receiver);
            },
        });
    }

    /** Encrypts every marked property of every entity about to be written. */
    private async encryptChanges(event: DbPluginBulkPersistEvent): Promise<void> {
        for (const [schemaId, changes] of event.operation) {

            if (!changes || changes.hasItems === false) {
                continue;
            }

            const properties = encryptedProperties(event.schemas.get(schemaId));

            if (properties.length === 0) {
                continue;
            }

            for (const { property, mode } of properties) {
                for (const entity of changes.adds as Record<string, unknown>[]) {
                    await this.encryptValue(entity, property, mode);
                }

                for (const update of changes.updates as UpdateInfo[]) {
                    await this.encryptValue(update.entity, property, mode);

                    /**
                     * The delta as well as the entity, because the SQL builders write the
                     * DELTA — `toColumnValueMap(update.delta, ...)` — and only fall back to
                     * the entity for columns the delta does not mention. Encrypting one and
                     * not the other wrote a raw number into a column the view had already
                     * declared TEXT, and SQLite coerced it: a salary of 2 came back as the
                     * string "2.0".
                     */
                    if (update.delta != null && property.name in update.delta) {
                        await this.encryptValue(update.delta, property, mode);
                    }
                }

                // Removes are matched by key, and a key is never encrypted, so they need
                // nothing. Their echo does, and `decryptPersistResult` handles it.
            }
        }
    }

    private async encryptValue(
        entity: Record<string, unknown>,
        property: PropertyInfo<any>,
        mode: EncryptionMode
    ): Promise<void> {
        const value = entity[property.name];

        if (value == null || isEnvelope(value)) {
            // Already encrypted: an entity read back and saved again must not be encrypted
            // twice, which would leave a value nothing can read without decrypting in layers.
            return;
        }

        if (isEncryptable(value, property) === false) {
            throw new Error(
                `Cannot encrypt '${property.name}': it is declared ${property.type} and holds ` +
                `a ${typeof value}.`
            );
        }

        entity[property.name] = await encrypt(this.keyring, toText(value, property), {
            deterministic: mode === 'deterministic',
        });
    }

    /**
     * Rewrites or rejects any filter that touches an encrypted property.
     *
     * A deterministic property compares by equality against the ciphertext, so the value in
     * the filter is encrypted in place and the database does the rest with its index.
     * Everything else throws, because there is no correct answer it could return.
     */
    private async prepareFilters(
        event: DbPluginQueryEvent<any, any>,
        properties: EncryptedProperty[]
    ): Promise<void> {
        const byName = new Map(properties.map(p => [p.property.name, p]));
        const filters = event.operation.options.get('filter') ?? [];

        for (const filter of filters as FilterOption[]) {
            const value = filter.option?.value;

            if (value == null) {
                continue;
            }

            /**
             * A filter reaches a plugin twice over, and both have to be rewritten.
             *
             * A translator-based plugin — SQL, Dexie — walks `expression`. An in-process
             * plugin calls the original lambda instead: `source.filter(w => filter([w,
             * params]))`, straight past the expression. Rewriting only one of them works on
             * half the backends, which is worse than working on none.
             */
            const encryptedValues = new Set<string>();
            const plainValues = new Set<string>();

            await this.prepareExpression(value.expression, byName, encryptedValues, plainValues);

            this.encryptParams(value, encryptedValues, plainValues);
        }
    }

    /**
     * Replaces params that are compared against an encrypted property with their ciphertext.
     *
     * Matched by value, because a `ValueExpression` does not record which param it came from.
     * A value used BOTH against an encrypted property and against a plain one cannot be
     * rewritten either way without breaking the other, so it throws rather than choosing.
     */
    private encryptParams(
        value: { params?: Record<string, unknown> },
        encryptedValues: Set<string>,
        plainValues: Set<string>
    ): void {
        if (value.params == null || encryptedValues.size === 0) {
            return;
        }

        for (const [key, param] of Object.entries(value.params)) {
            if (typeof param !== 'string' || encryptedValues.has(param) === false) {
                continue;
            }

            if (plainValues.has(param)) {
                throw new Error(
                    `The value in param '${key}' is compared against both an encrypted ` +
                    'property and an unencrypted one in the same filter. One needs the ' +
                    'ciphertext and the other needs the plaintext, so neither can be right. ' +
                    'Split the comparisons into separate params.'
                );
            }

            value.params[key] = this.ciphertexts.get(param);
        }
    }

    private async prepareExpression(
        expression: unknown,
        byName: Map<string, EncryptedProperty>,
        encryptedValues: Set<string>,
        plainValues: Set<string>
    ): Promise<void> {
        const node = expression as ExpressionNode | null | undefined;

        if (node == null || typeof node !== 'object') {
            return;
        }

        if (node.type === 'comparator') {
            await this.prepareComparator(node, byName, encryptedValues, plainValues);
        }

        await this.prepareExpression(node.left, byName, encryptedValues, plainValues);
        await this.prepareExpression(node.right, byName, encryptedValues, plainValues);
    }

    private async prepareComparator(
        node: ExpressionNode,
        byName: Map<string, EncryptedProperty>,
        encryptedValues: Set<string>,
        plainValues: Set<string>
    ): Promise<void> {
        const sides = [node.left, node.right];
        const propertyNode = sides.find(side => side?.type === 'property');
        const valueNode = sides.find(side => side?.type === 'value');

        if (propertyNode == null) {
            return;
        }

        const name = propertyNode.property?.name;
        const encryptedProperty = name == null ? undefined : byName.get(name);

        if (encryptedProperty == null) {
            // Recorded so a param carrying this value is left as plaintext.
            if (typeof valueNode?.value === 'string') {
                plainValues.add(valueNode.value);
            }

            return;
        }

        if (encryptedProperty.mode === 'randomised') {
            throw new Error(
                `'${name}' is encrypted and cannot be filtered. Every write uses a fresh ` +
                'initialisation vector, so the same value has a different ciphertext each ' +
                'time and no comparison in the database can match it. Mark the property ' +
                '`encrypted(s.string(), { searchable: true })` if it must be looked up — ' +
                'which makes rows holding the same value visibly equal in storage.'
            );
        }

        if (node.comparator !== 'equals' || valueNode == null) {
            throw new Error(
                `'${name}' is encrypted, so only an equality comparison can run against it. ` +
                `A '${String(node.comparator)}' comparison would run against the ciphertext, ` +
                'which does not order or match like the value it hides, and would return rows ' +
                'that look correct and are not.'
            );
        }

        if (typeof valueNode.value !== 'string') {
            throw new Error(
                `'${name}' is encrypted and was compared against a ${typeof valueNode.value}. ` +
                'Only a string can be encrypted to compare against it.'
            );
        }

        // Deterministic, so this is the exact ciphertext the write produced.
        const plaintext = valueNode.value;
        const ciphertext = await encrypt(this.keyring, plaintext, { deterministic: true });

        this.ciphertexts.set(plaintext, ciphertext);
        encryptedValues.add(plaintext);

        valueNode.value = ciphertext;
    }

    /**
     * Decrypts every marked property in a query result.
     *
     * A result is an `ITranslatedValue`, not an array. Its `forEach` replaces an item with
     * whatever the callback returns, which is the hook this needs — but `forEach` is
     * synchronous and decryption is not, so it takes two passes: collect, decrypt, then
     * replace in the same order.
     *
     * A shaped query can return a scalar or an aggregate instead of rows. Those have no
     * properties to decrypt and fall through untouched.
     */
    private async decryptResult(data: unknown, properties: EncryptedProperty[]): Promise<void> {
        const translated = data as {
            forEach?: (callback: (item: unknown) => unknown) => void;
        } | null;

        if (typeof translated?.forEach !== 'function') {
            return;
        }

        const rows: unknown[] = [];
        translated.forEach(item => { rows.push(item); return item; });

        const decrypted: Record<string, unknown>[] = [];

        for (const row of rows) {
            decrypted.push(await this.decryptRow(row as Record<string, unknown>, properties));
        }

        let index = 0;
        translated.forEach(() => decrypted[index++]);
    }

    /**
     * Returns a copy of `row` with its encrypted properties decrypted.
     *
     * A COPY, and that is not a stylistic preference. An in-process plugin can hand back the
     * very object it is storing, so decrypting in place writes the plaintext straight into the
     * database. Every round-trip test still passed — the value went in and came out — while
     * the stored record held the secret in the clear. Only a test that read the backend
     * directly caught it.
     */
    private async decryptRow(
        row: Record<string, unknown>,
        properties: EncryptedProperty[]
    ): Promise<Record<string, unknown>> {
        if (row == null || typeof row !== 'object') {
            // A shaped query can return a scalar or an aggregate, neither of which has
            // properties to decrypt.
            return row;
        }

        let copy: Record<string, unknown> | null = null;

        for (const { property } of properties) {
            const value = row[property.name];

            if (isEnvelope(value) === false) {
                continue;
            }

            copy ??= { ...row };
            copy[property.name] = fromText(await decrypt(this.keyring, value), property);
        }

        return copy ?? row;
    }

    /** Decrypts the rows a persist echoed back, so the change tracker sees plaintext. */
    private async decryptPersistResult(
        event: DbPluginBulkPersistEvent,
        result: BulkPersistResult
    ): Promise<void> {
        for (const [schemaId, changes] of result) {
            const properties = encryptedProperties(event.schemas.get(schemaId));

            if (properties.length === 0) {
                continue;
            }

            for (const bucket of [changes.adds, changes.updates, changes.removes]) {
                const rows = bucket as Record<string, unknown>[];

                for (let i = 0; i < rows.length; i++) {
                    rows[i] = await this.decryptRow(rows[i], properties);
                }
            }
        }
    }
}

type EncryptedProperty = { property: PropertyInfo<any>; mode: EncryptionMode };

type UpdateInfo = { entity: Record<string, unknown>; delta?: Record<string, unknown> };

/** The minimum an expression node has to look like for this to walk it. */
type FilterOption = {
    option?: { value?: { expression?: unknown; params?: Record<string, unknown> } };
};

type ExpressionNode = {
    type?: string;
    comparator?: unknown;
    value?: unknown;
    property?: { name?: string };
    left?: ExpressionNode;
    right?: ExpressionNode;
};

/**
 * Every encrypted property of a schema.
 *
 * Root properties only. A nested object is stored whole, so encrypting one of its children
 * would mean rewriting the parent's JSON — possible, and not something to do quietly.
 */
export const encryptedProperties = <T extends {}>(schema: CompiledSchema<T>): EncryptedProperty[] => {
    const found: EncryptedProperty[] = [];

    for (const property of schema.properties) {
        if (property.parent != null) {
            continue;
        }

        const mode = property.encryption;

        if (mode == null) {
            continue;
        }

        found.push({ property, mode });
    }

    return found;
};
