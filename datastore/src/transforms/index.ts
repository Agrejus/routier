import { SchemaTypes } from '@routier/core/schema';
import type { CompiledSchema, PropertyInfo, PropertyTransform } from '@routier/core/schema';
import type { DbPluginBulkPersistEvent, DbPluginQueryEvent } from '@routier/core/plugins';
import type { BulkPersistResult, SchemaCollection } from '@routier/core/collections';

/**
 * Running the transforms a schema declares.
 *
 * A transform is declared on a property — `x.transform({ to, from })` — and applied here, in
 * the datastore, on the way to the plugin and back. It deliberately does not live in a plugin:
 * a plugin's job is storing data, and by the time one is handed an entity the value should
 * already be in its stored form. Nothing below this line knows a transform happened.
 *
 * Core ships no transform of its own. What runs is whatever the caller supplied.
 */

export type TransformedProperty = { property: PropertyInfo<any>; transform: PropertyTransform<unknown> };

/**
 * Every transformed property of a schema.
 *
 * Root properties only. A nested object is stored whole, so transforming one of its children
 * would mean rewriting the parent — possible, and not something to do silently.
 */
export const transformedProperties = <T extends {}>(schema: CompiledSchema<T>): TransformedProperty[] => {
    const found: TransformedProperty[] = [];

    for (const property of schema.properties) {
        if (property.parent == null && property.transform != null) {
            found.push({ property, transform: property.transform });
        }
    }

    return found;
};

/** Whether any schema in play declares a transform, so the common case costs nothing. */
export const hasTransforms = (schemas: SchemaCollection): boolean => {
    for (const schema of schemas as unknown as Iterable<CompiledSchema<any>>) {
        if (transformedProperties(schema).length > 0) {
            return true;
        }
    }

    return false;
};

// ---------------------------------------------------------------------------------------
// The schema a plugin sees
// ---------------------------------------------------------------------------------------

const views = new WeakMap<object, CompiledSchema<any>>();

/**
 * The schema view a plugin receives: transformed properties typed as what they store.
 *
 * A transform whose output is not the property's own type — a cipher producing text from a
 * number — declares `stores`. Rather than teaching every plugin about transforms, they are
 * handed a view of the compiled schema in which those properties say so, and each then builds
 * the right column, skips JSON encoding and indexes it correctly through unmodified code.
 *
 * Prototype delegation, and `Object.defineProperty` on the derived object rather than
 * assignment: it defines an own property shadowing the original, so the real `PropertyInfo` is
 * untouched and would stay untouched even if it were frozen.
 */
export const schemaView = <T extends {}>(schema: CompiledSchema<T>): CompiledSchema<T> => {
    const cached = views.get(schema as unknown as object);

    if (cached != null) {
        return cached as CompiledSchema<T>;
    }

    const restyled = new Map<string, SchemaTypes>();

    for (const { property, transform } of transformedProperties(schema)) {
        if (transform.stores != null && transform.stores !== property.type) {
            restyled.set(property.name, transform.stores);
        }
    }

    if (restyled.size === 0) {
        return schema;
    }

    /**
     * A property that changes type loses its children with it.
     *
     * `profile` transformed into one text column is not an object any more. Leaving `city` and
     * `score` in the list has a plugin still trying to rebuild a nested object, reading those
     * fields off a string, and producing `undefined` — surfacing far away, in generated code.
     */
    const isUnderRestyled = (property: PropertyInfo<any>) => {
        let current: PropertyInfo<any> | undefined = property;

        while (current?.parent != null) {
            current = current.parent as PropertyInfo<any>;
        }

        return current != null && current !== property && restyled.has(current.name);
    };

    const view = Object.create(schema) as CompiledSchema<T>;

    Object.defineProperty(view, 'properties', {
        value: schema.properties
            .filter(property => isUnderRestyled(property) === false)
            .map(property => {
                const stores = property.parent == null ? restyled.get(property.name) : undefined;

                if (stores == null) {
                    return property;
                }

                const restyledProperty = Object.create(property);

                Object.defineProperty(restyledProperty, 'type', { value: stores, enumerable: true });

                return restyledProperty;
            }),
        enumerable: true,
    });

    /**
     * A deep copy rather than the schema's generated `clone`.
     *
     * The generated one rebuilds a nested object from the children it declares, and a
     * transformed object has none any more. In-process plugins already fall back to
     * `structuredClone` when they cannot trust the generated clone; this is that situation.
     */
    Object.defineProperty(view, 'clone', {
        value: (record: unknown) => structuredClone(record),
        enumerable: true,
    });

    views.set(schema as unknown as object, view);

    return view;
};

/** A SchemaCollection whose every schema is the view. */
export const schemaCollectionView = (schemas: SchemaCollection): SchemaCollection =>
    new Proxy(schemas, {
        get(target, property, receiver) {
            if (property === 'get') {
                return (id: never) =>
                    schemaView((target as unknown as { get(id: never): CompiledSchema<any> }).get(id));
            }

            return Reflect.get(target, property, receiver);
        },
    });

// ---------------------------------------------------------------------------------------
// Applying them
// ---------------------------------------------------------------------------------------

/** Runs `to` over every transformed property of everything about to be written. */
export const applyToChanges = async (event: DbPluginBulkPersistEvent): Promise<void> => {
    for (const [schemaId, changes] of event.operation) {

        if (!changes || changes.hasItems === false) {
            continue;
        }

        const properties = transformedProperties(event.schemas.get(schemaId) as CompiledSchema<any>);

        if (properties.length === 0) {
            continue;
        }

        for (const { property, transform } of properties) {
            for (const entity of changes.adds as Record<string, unknown>[]) {
                await applyTo(entity, property, transform, entity);
            }

            for (const update of changes.updates as UpdateInfo[]) {
                await applyTo(update.entity, property, transform, update.entity);

                /**
                 * The delta as well as the entity: the SQL builders write the DELTA and only
                 * fall back to the entity for columns it does not mention. Transforming one
                 * and not the other writes a raw value into a column whose type the view has
                 * already changed.
                 */
                if (update.delta != null && property.name in update.delta) {
                    await applyTo(update.delta, property, transform, update.entity);
                }
            }

            // Removes are matched by key and a key is never transformed. Their echo is
            // handled with the rest, below.
        }
    }
};

type UpdateInfo = { entity: Record<string, unknown>; delta?: Record<string, unknown> };

const applyTo = async (
    target: Record<string, unknown>,
    property: PropertyInfo<any>,
    transform: PropertyTransform<unknown>,
    entity: Record<string, unknown>
): Promise<void> => {
    const value = target[property.name];

    if (value === undefined) {
        return;
    }

    target[property.name] = await transform.to(value, entity);
};

/**
 * Runs `from` over one row, returning a COPY.
 *
 * A copy, and not for tidiness. An in-process plugin can hand back the very object it is
 * storing, so transforming in place writes the application value straight into the database —
 * every round trip still passes while the stored record holds the untransformed value.
 */
export const applyFromRow = async (
    row: Record<string, unknown>,
    properties: TransformedProperty[]
): Promise<Record<string, unknown>> => {
    if (row == null || typeof row !== 'object') {
        // A shaped query can return a scalar or an aggregate, which has nothing to transform.
        return row;
    }

    let copy: Record<string, unknown> | null = null;

    for (const { property, transform } of properties) {
        if (transform.from == null || property.name in row === false) {
            // No `from` means a one-way transform: the stored value is the value.
            continue;
        }

        copy ??= { ...row };
        copy[property.name] = await transform.from(row[property.name]);
    }

    return copy ?? row;
};

/**
 * Runs `from` over a query result.
 *
 * A result is an `ITranslatedValue`, not an array, and its `forEach` replaces an item with
 * whatever the callback returns. That is the hook — but `forEach` is synchronous and a
 * transform may not be, so it takes two passes: collect, transform, replace in order.
 */
export const applyFromResult = async (data: unknown, properties: TransformedProperty[]): Promise<void> => {
    const translated = data as { forEach?: (callback: (item: unknown) => unknown) => void } | null;

    if (typeof translated?.forEach !== 'function' || properties.length === 0) {
        return;
    }

    const rows: unknown[] = [];
    translated.forEach(item => { rows.push(item); return item; });

    const transformed: Record<string, unknown>[] = [];

    for (const row of rows) {
        transformed.push(await applyFromRow(row as Record<string, unknown>, properties));
    }

    let index = 0;
    translated.forEach(() => transformed[index++]);
};

/** Runs `from` over the rows a persist echoed back, so the change tracker sees plain values. */
export const applyFromPersistResult = async (
    event: DbPluginBulkPersistEvent,
    result: BulkPersistResult
): Promise<void> => {
    for (const [schemaId, changes] of result) {
        const properties = transformedProperties(event.schemas.get(schemaId) as CompiledSchema<any>);

        if (properties.length === 0) {
            continue;
        }

        for (const bucket of [changes.adds, changes.updates, changes.removes]) {
            const rows = bucket as Record<string, unknown>[];

            for (let i = 0; i < rows.length; i++) {
                rows[i] = await applyFromRow(rows[i], properties);
            }
        }
    }
};

// ---------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------

type ExpressionNode = {
    type?: string;
    comparator?: unknown;
    value?: unknown;
    property?: { name?: string };
    left?: ExpressionNode;
    right?: ExpressionNode;
};

type FilterOption = {
    option?: { value?: { expression?: unknown; params?: Record<string, unknown> } };
};

/**
 * Rewrites or rejects any filter that touches a transformed property.
 *
 * A transform declaring `comparable: 'equality'` is deterministic, so the value in the filter
 * can be transformed and compared against the stored form — the database does the work and
 * uses its index. Anything else throws, because there is no correct answer it could return: a
 * transformed value does not order or match like the value it replaced.
 */
export const prepareFilters = async (
    event: DbPluginQueryEvent<any, any>,
    properties: TransformedProperty[]
): Promise<void> => {
    if (properties.length === 0) {
        return;
    }

    const byName = new Map(properties.map(p => [p.property.name, p]));
    const filters = (event.operation.options.get('filter') ?? []) as FilterOption[];

    for (const filter of filters) {
        const value = filter.option?.value;

        if (value == null) {
            continue;
        }

        /**
         * A filter reaches a plugin twice over, and both have to be rewritten. A
         * translator-based plugin walks `expression`; an in-process one calls the original
         * lambda with `params`, straight past the expression.
         */
        const transformedValues = new Map<unknown, unknown>();
        const plainValues = new Set<unknown>();

        await walk(value.expression, byName, transformedValues, plainValues);

        rewriteParams(value, transformedValues, plainValues);
    }
};

const walk = async (
    expression: unknown,
    byName: Map<string, TransformedProperty>,
    transformedValues: Map<unknown, unknown>,
    plainValues: Set<unknown>
): Promise<void> => {
    const node = expression as ExpressionNode | null | undefined;

    if (node == null || typeof node !== 'object') {
        return;
    }

    if (node.type === 'comparator') {
        await compare(node, byName, transformedValues, plainValues);
    }

    await walk(node.left, byName, transformedValues, plainValues);
    await walk(node.right, byName, transformedValues, plainValues);
};

const compare = async (
    node: ExpressionNode,
    byName: Map<string, TransformedProperty>,
    transformedValues: Map<unknown, unknown>,
    plainValues: Set<unknown>
): Promise<void> => {
    const sides = [node.left, node.right];
    const propertyNode = sides.find(side => side?.type === 'property');
    const valueNode = sides.find(side => side?.type === 'value');

    if (propertyNode == null) {
        return;
    }

    const name = propertyNode.property?.name;
    const found = name == null ? undefined : byName.get(name);

    if (found == null) {
        // Recorded so a param carrying this value is left alone.
        if (valueNode != null) {
            plainValues.add(valueNode.value);
        }

        return;
    }

    if (found.transform.comparable !== 'equality') {
        throw new Error(
            `'${name}' is transformed and cannot be filtered. Its transform does not declare ` +
            "`comparable: 'equality'`, which means the stored value cannot be matched against " +
            'a value from your filter. Query on an untransformed property, or set that flag ' +
            'if the transform really is deterministic.'
        );
    }

    if (node.comparator !== 'equals' || valueNode == null) {
        throw new Error(
            `'${name}' is transformed, so only an equality comparison can run against it. A ` +
            `'${String(node.comparator)}' comparison would run against the stored value, ` +
            'which does not order or match like the value it replaced, and would return rows ' +
            'that look correct and are not.'
        );
    }

    const plaintext = valueNode.value;
    const stored = await found.transform.to(plaintext, {});

    transformedValues.set(plaintext, stored);
    valueNode.value = stored;
};

/**
 * Replaces params compared against a transformed property with their stored form.
 *
 * Matched by value, because a value expression does not record which param it came from. A
 * value used BOTH against a transformed property and a plain one cannot be rewritten either
 * way without breaking the other, so it throws rather than choosing.
 */
const rewriteParams = (
    value: { params?: Record<string, unknown> },
    transformedValues: Map<unknown, unknown>,
    plainValues: Set<unknown>
): void => {
    if (value.params == null || transformedValues.size === 0) {
        return;
    }

    for (const [key, param] of Object.entries(value.params)) {
        if (transformedValues.has(param) === false) {
            continue;
        }

        if (plainValues.has(param)) {
            throw new Error(
                `The value in param '${key}' is compared against both a transformed property ` +
                'and an untransformed one in the same filter. One needs the stored form and ' +
                'the other needs the original, so neither can be right. Split them into ' +
                'separate params.'
            );
        }

        value.params[key] = transformedValues.get(param);
    }
};
