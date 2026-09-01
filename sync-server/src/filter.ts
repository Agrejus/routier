/**
 * Evaluating the `filter` query parameter the replication client sends.
 *
 * `@routier/replication-plugin`'s `queryParamHelpers.buildQueryParams` serializes a Routier
 * expression tree into JSON and puts it in `?filter=`. A server that ignores it returns the
 * whole collection, the client filters in memory, and every test still passes — which is
 * exactly the failure this server exists to avoid. Honouring the parameter is what makes a
 * paginated or filtered read mean anything.
 *
 * The shape mirrors `expressionToFilterJson`:
 *
 *   { type: 'operator',   operator: '&&' | '||', left, right }
 *   { type: 'comparator', comparator, negated, left, right }
 *   { type: 'property',   name, path? }
 *   { type: 'value',      value }
 */

export type FilterNode =
    | { type: 'operator'; operator?: string; left?: FilterNode; right?: FilterNode }
    | { type: 'comparator'; comparator?: string; negated?: boolean; left?: FilterNode; right?: FilterNode }
    | { type: 'property'; name?: string; path?: string[] }
    | { type: 'value'; value?: unknown };

type Row = Record<string, unknown>;

const readPath = (row: Row, node: Extract<FilterNode, { type: 'property' }>): unknown => {
    const path = node.path ?? (node.name == null ? [] : [node.name]);

    let current: unknown = row;

    for (const segment of path) {
        if (current == null || typeof current !== 'object') {
            return undefined;
        }

        current = (current as Row)[segment];
    }

    return current;
};

/** A comparator operand: either a column read or a literal. */
const operand = (node: FilterNode | undefined, row: Row): unknown => {
    if (node == null) {
        return undefined;
    }

    if (node.type === 'property') {
        return readPath(row, node);
    }

    if (node.type === 'value') {
        return node.value;
    }

    return undefined;
};

/**
 * Dates arrive as ISO strings (the serializer stringifies them), so a stored Date has to be
 * compared in the same form or every date predicate silently returns nothing.
 */
const comparable = (value: unknown): unknown => (value instanceof Date ? value.toISOString() : value);

const compare = (comparator: string, left: unknown, right: unknown): boolean => {
    const a = comparable(left);
    const b = comparable(right);

    switch (comparator) {
        case 'equals':
            return a === b;
        case 'greater-than':
            return (a as number) > (b as number);
        case 'greater-than-equals':
            return (a as number) >= (b as number);
        case 'less-than':
            return (a as number) < (b as number);
        case 'less-than-equals':
            return (a as number) <= (b as number);
        case 'starts-with':
            return typeof a === 'string' && typeof b === 'string' && a.startsWith(b);
        case 'ends-with':
            return typeof a === 'string' && typeof b === 'string' && a.endsWith(b);
        case 'includes':
            if (Array.isArray(b)) {
                return b.includes(a);
            }
            return typeof a === 'string' && typeof b === 'string' && a.includes(b);
        default:
            // An unknown comparator must not silently match everything — that would turn a
            // filtered read into a full read and hide the bug this server hunts.
            throw new Error(`sync-server: unsupported comparator '${comparator}' in filter`);
    }
};

export function matchesFilter(row: Row, node: FilterNode | undefined): boolean {
    if (node == null) {
        return true;
    }

    if (node.type === 'operator') {
        const left = matchesFilter(row, node.left);
        const right = matchesFilter(row, node.right);

        return node.operator === '||' ? left || right : left && right;
    }

    if (node.type === 'comparator') {
        // The client normalizes property-on-left, but a value-on-left tree is still legal, so
        // both orders are handled rather than assumed.
        const leftIsProperty = node.left?.type === 'property';
        const columnNode = leftIsProperty ? node.left : node.right;
        const valueNode = leftIsProperty ? node.right : node.left;

        const result = compare(
            node.comparator ?? 'equals',
            operand(columnNode, row),
            operand(valueNode, row)
        );

        return node.negated === true ? result === false : result;
    }

    if (node.type === 'property' || node.type === 'value') {
        // A bare property or value as a predicate: truthiness, matching JavaScript.
        return Boolean(operand(node, row));
    }

    // Any other node reaches `operand` as undefined, and `Boolean(undefined)` excludes every row —
    // a filtered read returning nothing, with no error to explain it.
    throw new Error(
        `sync-server: unsupported filter node '${(node as { type: string }).type}' in filter. ` +
        `Refusing rather than excluding every row.`
    );
}

/** `?sort=name:asc,price:desc` */
export function applySort(rows: Row[], sort: string | null): Row[] {
    if (sort == null || sort === '') {
        return rows;
    }

    const terms = sort.split(',').map(term => {
        const [property, direction] = term.split(':');
        return { property, descending: direction === 'desc' };
    });

    return [...rows].sort((a, b) => {
        for (const { property, descending } of terms) {
            const left = comparable(a[property]) as never;
            const right = comparable(b[property]) as never;

            if (left === right) {
                continue;
            }

            const order = left < right ? -1 : 1;

            return descending ? -order : order;
        }

        return 0;
    });
}
