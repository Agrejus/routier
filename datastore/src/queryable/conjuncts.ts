import { Expression, parseFragment, toPredicate } from "@routier/core/expressions";
import { CompiledSchema } from "@routier/core/schema";
import { QueryOptionValueMap } from "@routier/core/plugins";

/**
 * Splitting a post-join `where` so the half that belongs to one side can be pushed down.
 *
 * `.where(([p, m]) => p.region === "east" && m.rank > 10)` runs over the PAIRS, which is correct
 * and reads both collections whole. Each `&&` conjunct here mentions one side only, so each could
 * have narrowed its own read — `region = 'east'` on the outer table, `rank > 10` on the inner one.
 * That is all this does.
 *
 * ## Why splitting the SOURCE, and not the parsed tree
 *
 * A tuple lambda cannot be parsed as one tree: `toExpression` resolves a two-root lambda as
 * `(entity, params)`, so `m` would be read as a params bag and bind to nothing. Splitting the text
 * first means each conjunct is parsed on its own, against ONE schema and ONE root — which the
 * parser already does. A conjunct naming the other side simply fails, and failure is how the side
 * is identified rather than something to recover from.
 *
 * ## Why the original filter is never removed
 *
 * A split conjunct is ADDED as a narrowing filter; the caller's own predicate stays exactly where
 * it was and re-checks every surviving pair. So the worst this can do is narrow too little — a
 * conjunct it failed to classify, or one whose evaluation is uncertain — which costs a little
 * speed. It cannot narrow too much, because nothing downstream depends on it having been right.
 *
 * Replacing the filter with its residue would invert that: one misclassified conjunct would drop
 * rows from the result, and nothing would report it.
 */

/** A conjunct that belongs to exactly one side, with everything needed to push it down. */
export type SplitConjunct = {
    side: "outer" | "inner";
    filter: QueryOptionValueMap<any>["filter"];
};

/**
 * Splits `source` on top-level `&&`, respecting nesting and string literals.
 *
 * Top-level only. A conjunct inside parentheses or behind a `||` is not independently true of a
 * matching row, so lifting it out would change the predicate rather than narrow it.
 */
export const splitTopLevelConjuncts = (source: string): string[] => {
    const parts: string[] = [];

    let depth = 0;
    let quote: string | null = null;
    let start = 0;

    for (let i = 0; i < source.length; i++) {
        const character = source[i];

        if (quote != null) {
            // A backslash escapes the next character, so an escaped quote does not close the string
            if (character === "\\") {
                i++;
            } else if (character === quote) {
                quote = null;
            }

            continue;
        }

        if (character === '"' || character === "'" || character === "`") {
            quote = character;
            continue;
        }

        if (character === "(" || character === "[" || character === "{") {
            depth++;
            continue;
        }

        if (character === ")" || character === "]" || character === "}") {
            depth--;
            continue;
        }

        if (depth === 0 && character === "&" && source[i + 1] === "&") {
            parts.push(source.slice(start, i));
            i++;
            start = i + 1;
        }
    }

    parts.push(source.slice(start));

    return parts.map(part => part.trim()).filter(part => part.length > 0);
};

/**
 * The two root names of a tuple lambda, or `null` when the source is not one.
 *
 * `([p, m]) => ...` and `([p, m]) => { return ...; }` both yield `["p", "m"]`. Anything else — a
 * single parameter, a rest element, a nested pattern — is not a shape this understands, and
 * returning `null` leaves the filter exactly where it was.
 */
export const tupleRootsAndBody = (source: string): { outerRoot: string, innerRoot: string, body: string } | null => {
    const arrowIndex = source.indexOf("=>");

    if (arrowIndex < 0) {
        return null;
    }

    const head = source.slice(0, arrowIndex);
    const destructured = /^\s*\(?\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*\)?\s*$/.exec(head);

    if (destructured == null) {
        return null;
    }

    let body = source.slice(arrowIndex + 2).trim();

    // A single-return block body carries the same expression, just wrapped
    const block = /^\{\s*return\s+([\s\S]*?);?\s*\}$/.exec(body);

    if (block != null) {
        body = block[1].trim();
    }

    if (body.length === 0) {
        return null;
    }

    return { outerRoot: destructured[1], innerRoot: destructured[2], body };
};

/**
 * Classifies each top-level conjunct of a tuple filter, keeping only the single-side ones.
 *
 * A conjunct is assigned to a side only when it parses cleanly against THAT side's schema and root
 * and nothing else. Everything unclear is dropped from the result — the caller's filter still runs
 * over the pairs, so dropping a conjunct here loses speed and never rows.
 */
export const splitTupleFilter = <TOuter extends {}, TInner extends {}>(options: {
    filter: unknown;
    outerSchema: CompiledSchema<TOuter>;
    innerSchema: CompiledSchema<TInner>;
}): SplitConjunct[] => {
    const { filter, outerSchema, innerSchema } = options;

    if (typeof filter !== "function") {
        return [];
    }

    const shape = tupleRootsAndBody(filter.toString());

    if (shape == null) {
        return [];
    }

    const conjuncts = splitTopLevelConjuncts(shape.body);

    // A single conjunct is the whole predicate. Pushing it to one side is still worth doing — the
    // filter it duplicates is cheap next to the rows it stops reading.
    const split: SplitConjunct[] = [];

    for (const conjunct of conjuncts) {
        const asOuter = parseFragment(outerSchema, conjunct, shape.outerRoot);

        if (Expression.isNotParsable(asOuter) === false && Expression.isEmpty(asOuter) === false) {
            split.push({ side: "outer", filter: { filter: toPredicate(asOuter) as never, expression: asOuter, params: undefined } });
            continue;
        }

        const asInner = parseFragment(innerSchema, conjunct, shape.innerRoot);

        if (Expression.isNotParsable(asInner) === false && Expression.isEmpty(asInner) === false) {
            split.push({ side: "inner", filter: { filter: toPredicate(asInner) as never, expression: asInner, params: undefined } });
        }
    }

    return split;
};
