import { isComparatorExpression, isOperatorExpression, isPropertyExpression, isValueExpression } from "@routier/core/assertions";
import { Comparator, Expression } from "@routier/core/expressions";
import { CompiledSchema, SchemaTypes } from "@routier/core/schema";
import { QueryOption } from "@routier/core/plugins";
import type { Collection, Table } from "dexie";
import { compoundIndexGroupOf } from "./utils";

export type IndexKey = string | number;

export type RangeBound = { value: IndexKey; inclusive: boolean };

export type IndexSeed =
    | { kind: "equals"; indexName: string; value: IndexKey; coversWholeFilter: boolean }
    | { kind: "anyOf"; indexName: string; values: IndexKey[]; coversWholeFilter: boolean }
    | { kind: "compound"; indexName: string; values: IndexKey[]; coversWholeFilter: boolean }
    | { kind: "range"; indexName: string; lower: RangeBound | null; upper: RangeBound | null; coversWholeFilter: boolean };

export type SortSeed = { indexName: string; direction: "asc" | "desc" };

export type SeedableIndexes = {
    names: ReadonlySet<string>;
    compoundGroups: readonly (readonly string[])[];
};

const seedableIndexesCache = new WeakMap<CompiledSchema<any>, SeedableIndexes>();

/**
 * The root properties a query may seek with `where(name)`, derived from the schema's EXPLICIT
 * declarations the same way `convertToDexieSchema` builds the stores string: a non-composite
 * primary key, a `.distinct()` property, or a `.index()` whose group holds only that property.
 * A property in a multi-member index group is excluded from `names` — the stores string gives
 * it only the compound `[a+b]` entry — and its group is listed in `compoundGroups` in the same
 * member order the stores string emits. Dexie's automatic per-property indexes are deliberately
 * not consulted: what the plugin seeks is defined by the schema, not by storage-side behavior.
 */
export const seedableIndexes = <T extends {}>(schema: CompiledSchema<T>): SeedableIndexes => {
    const cached = seedableIndexesCache.get(schema);

    if (cached != null) {
        return cached;
    }

    const compositeKey = schema.idProperties.length > 1;
    const names = new Set<string>();
    const compoundGroups: string[][] = [];
    const grouped = new Set<string>();

    for (const property of schema.properties) {
        if (property.level > 0 || property.isRenamed || property.type === SchemaTypes.Array) {
            continue;
        }

        if (property.isKey) {
            if (compositeKey === false) {
                names.add(property.name);
            }
            continue;
        }

        if (grouped.has(property.name)) {
            continue;
        }

        if (property.isDistinct === false && property.indexes.length === 0) {
            continue;
        }

        const group = compoundIndexGroupOf(schema, property);

        if (group.length === 1) {
            names.add(property.name);
            continue;
        }

        compoundGroups.push(group);
        group.forEach(name => grouped.add(name));
    }

    const result = { names, compoundGroups };

    seedableIndexesCache.set(schema, result);
    return result;
};

const isIndexKey = (value: unknown): value is IndexKey =>
    typeof value === "string" || (typeof value === "number" && Number.isNaN(value) === false);

const swappedComparators: Partial<Record<Comparator, Comparator>> = {
    "equals": "equals",
    "greater-than": "less-than",
    "greater-than-equals": "less-than-equals",
    "less-than": "greater-than",
    "less-than-equals": "greater-than-equals",
};

const rangeComparators: readonly Comparator[] = ["greater-than", "greater-than-equals", "less-than", "less-than-equals"];

type Comparison = { name: string; comparator: Comparator; value: IndexKey };

const comparisonOf = (expression: Expression): Comparison | null => {
    if (!isComparatorExpression(expression) || expression.negated === true) {
        return null;
    }

    if (expression.comparator === "equals" && expression.strict !== true) {
        return null;
    }

    const sides = [
        { propertySide: expression.left, valueSide: expression.right, comparator: expression.comparator },
        { propertySide: expression.right, valueSide: expression.left, comparator: swappedComparators[expression.comparator] },
    ];

    for (const { propertySide, valueSide, comparator } of sides) {
        if (comparator == null || !isPropertyExpression(propertySide) || !isValueExpression(valueSide)) {
            continue;
        }

        if (propertySide.property.level > 0 || !isIndexKey(valueSide.value)) {
            continue;
        }

        return { name: propertySide.property.name, comparator, value: valueSide.value };
    }

    return null;
};

const leavesOf = (expression: Expression | undefined, operator: "&&" | "||"): Expression[] => {
    if (expression == null) {
        return [];
    }

    if (isOperatorExpression(expression) && expression.operator === operator) {
        return [...leavesOf(expression.left, operator), ...leavesOf(expression.right, operator)];
    }

    return [expression];
};

const anyOfValues = (expression: Expression, names: ReadonlySet<string>): { name: string; values: IndexKey[] } | null => {
    const leaves = leavesOf(expression, "||");

    if (leaves.length < 2) {
        return null;
    }

    const comparisons = leaves.map(comparisonOf);
    const first = comparisons[0];

    if (first == null || first.comparator !== "equals" || names.has(first.name) === false) {
        return null;
    }

    if (comparisons.some(c => c == null || c.comparator !== "equals" || c.name !== first.name)) {
        return null;
    }

    return { name: first.name, values: comparisons.map(c => c!.value) };
};

const isLowerBound = (comparator: Comparator) => comparator === "greater-than" || comparator === "greater-than-equals";

const toBound = (comparison: Comparison): RangeBound => ({
    value: comparison.value,
    inclusive: comparison.comparator === "greater-than-equals" || comparison.comparator === "less-than-equals",
});

export const findIndexSeed = (expression: Expression, indexes: SeedableIndexes): IndexSeed | null => {
    const conjuncts = leavesOf(expression, "&&");
    const comparisons = conjuncts.map(comparisonOf);
    const covers = (consumed: number) => consumed === conjuncts.length;

    for (const group of indexes.compoundGroups) {
        const picks = group.map(name => comparisons.findIndex(c => c != null && c.comparator === "equals" && c.name === name));

        if (picks.every(index => index >= 0)) {
            return {
                kind: "compound",
                indexName: `[${group.join("+")}]`,
                values: picks.map(index => comparisons[index]!.value),
                coversWholeFilter: covers(new Set(picks).size),
            };
        }
    }

    const equality = comparisons.find(c => c != null && c.comparator === "equals" && indexes.names.has(c.name));

    if (equality != null) {
        return { kind: "equals", indexName: equality.name, value: equality.value, coversWholeFilter: covers(1) };
    }

    for (const conjunct of conjuncts) {
        const anyOf = anyOfValues(conjunct, indexes.names);

        if (anyOf != null) {
            return { kind: "anyOf", indexName: anyOf.name, values: anyOf.values, coversWholeFilter: covers(1) };
        }
    }

    const ranges = comparisons.filter((c): c is Comparison => c != null && rangeComparators.includes(c.comparator) && indexes.names.has(c.name));

    if (ranges.length === 0) {
        return null;
    }

    const name = ranges[0].name;
    const lower = ranges.find(c => c.name === name && isLowerBound(c.comparator)) ?? null;
    const upper = ranges.find(c => c.name === name && isLowerBound(c.comparator) === false) ?? null;

    return {
        kind: "range",
        indexName: name,
        lower: lower == null ? null : toBound(lower),
        upper: upper == null ? null : toBound(upper),
        coversWholeFilter: covers((lower == null ? 0 : 1) + (upper == null ? 0 : 1)),
    };
};

export const seekReplacesPredicate = (seed: IndexSeed): boolean => seed.coversWholeFilter;

const sortableTypes: readonly SchemaTypes[] = [SchemaTypes.String, SchemaTypes.Number, SchemaTypes.Date];

export const findSortSeed = <T>(sort: QueryOption<T, "sort">["value"], indexes: SeedableIndexes): SortSeed | null => {
    const property = sort.property;

    if (property == null || property.level > 0 || indexes.names.has(property.name) === false) {
        return null;
    }

    if (property.isNullable || property.isOptional || sortableTypes.includes(property.type) === false) {
        return null;
    }

    return { indexName: property.name, direction: sort.direction === "desc" ? "desc" : "asc" };
};

const keyOrder = (a: IndexKey, b: IndexKey) => a < b ? -1 : a > b ? 1 : 0;

export const applySeed = <T, TKey>(table: Table<T, TKey>, seed: IndexSeed): Collection<T, TKey>[] => {
    const where = table.where(seed.indexName);

    switch (seed.kind) {
        case "equals":
            return [where.equals(seed.value)];
        case "anyOf":
            return [...new Set(seed.values)].sort(keyOrder).map(value => table.where(seed.indexName).equals(value));
        case "compound":
            return [where.equals(seed.values)];
        case "range": {
            const { lower, upper } = seed;

            if (lower != null && upper != null) {
                return [where.between(lower.value, upper.value, lower.inclusive, upper.inclusive)];
            }

            if (lower != null) {
                return [lower.inclusive ? where.aboveOrEqual(lower.value) : where.above(lower.value)];
            }

            return [upper!.inclusive ? where.belowOrEqual(upper!.value) : where.below(upper!.value)];
        }
    }
};

export const applySort = <T, TKey>(table: Table<T, TKey>, seed: SortSeed): Collection<T, TKey> => {
    const ordered = table.orderBy(seed.indexName);

    return seed.direction === "desc" ? ordered.reverse() : ordered;
};

export const describeSeed = (seed: IndexSeed): { text: string; parameters: IndexKey[] } => {
    const where = `where("${seed.indexName}")`;

    switch (seed.kind) {
        case "equals":
            return { text: `${where}.equals(?)`, parameters: [seed.value] };
        case "anyOf":
            return { text: `${where}.anyOf(${seed.values.map(() => "?").join(", ")})`, parameters: seed.values };
        case "compound":
            return { text: `${where}.equals([${seed.values.map(() => "?").join(", ")}])`, parameters: seed.values };
        case "range": {
            const { lower, upper } = seed;

            if (lower != null && upper != null) {
                return { text: `${where}.between(?, ?, ${lower.inclusive}, ${upper.inclusive})`, parameters: [lower.value, upper.value] };
            }

            if (lower != null) {
                return { text: `${where}.${lower.inclusive ? "aboveOrEqual" : "above"}(?)`, parameters: [lower.value] };
            }

            return { text: `${where}.${upper!.inclusive ? "belowOrEqual" : "below"}(?)`, parameters: [upper!.value] };
        }
    }
};

export const describeSort = (seed: SortSeed): string =>
    `orderBy("${seed.indexName}")${seed.direction === "desc" ? ".reverse()" : ""}`;
