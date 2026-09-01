import { isComparatorExpression, isOperatorExpression, isPropertyExpression, isValueExpression } from "@routier/core/assertions";
import { Expression } from "@routier/core/expressions";
import { SchemaTypes } from "@routier/core/schema";

export type IndexSeed = {
    indexName: string;
    value: string | number | Date;
    coversWholeFilter: boolean;
};

const isIndexableValue = (value: unknown): value is string | number | Date =>
    typeof value === "string" || typeof value === "number" || value instanceof Date;

export type IndexSeedOptions = {
    compositeKey: boolean;
};

const equalitySeed = (expression: Expression, options: IndexSeedOptions): { indexName: string; value: string | number | Date } | null => {
    if (!isComparatorExpression(expression)) {
        return null;
    }

    if (expression.comparator !== "equals" || expression.negated === true || expression.strict !== true) {
        return null;
    }

    const sides = [
        { propertySide: expression.left, valueSide: expression.right },
        { propertySide: expression.right, valueSide: expression.left },
    ];

    for (const { propertySide, valueSide } of sides) {
        if (!isPropertyExpression(propertySide) || !isValueExpression(valueSide)) {
            continue;
        }

        const property = propertySide.property;

        if (property.level > 0 || property.isRenamed || property.type === SchemaTypes.Array) {
            continue;
        }

        if (property.isKey && options.compositeKey) {
            continue;
        }

        if (!isIndexableValue(valueSide.value)) {
            continue;
        }

        return { indexName: property.name, value: valueSide.value };
    }

    return null;
};

const seedFromConjunction = (expression: Expression, options: IndexSeedOptions): IndexSeed | null => {
    if (!isOperatorExpression(expression) || expression.operator !== "&&") {
        return null;
    }

    for (const side of [expression.left, expression.right]) {
        if (side == null) {
            continue;
        }

        const direct = equalitySeed(side, options);

        if (direct != null) {
            return { ...direct, coversWholeFilter: false };
        }

        const nested = seedFromConjunction(side, options);

        if (nested != null) {
            return nested;
        }
    }

    return null;
};

export const findIndexSeed = (expression: Expression, options: IndexSeedOptions): IndexSeed | null => {
    const direct = equalitySeed(expression, options);

    if (direct != null) {
        return { ...direct, coversWholeFilter: true };
    }

    return seedFromConjunction(expression, options);
};
