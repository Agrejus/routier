import { ExpressionType } from "./types";

/**
 * A `Record` rather than a list, so adding to `ExpressionType` without adding it here is a compile
 * error. As a list it was not exhaustive, and `call` was silently missing from `isExpression`.
 */
const EXPRESSION_TYPE_SET: Record<ExpressionType, true> = {
    "operator": true,
    "comparator": true,
    "property": true,
    "value": true,
    "call": true,
    "empty": true,
    "not-parsable": true,
};

export const EXPRESSION_TYPES = Object.keys(EXPRESSION_TYPE_SET) as ExpressionType[];
