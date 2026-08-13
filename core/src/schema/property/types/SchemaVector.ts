import { DefaultValue, SchemaModifiers, SchemaTypes } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaDefault } from "../modifiers/SchemaDefault";
import { SchemaFrom } from "../modifiers/SchemaFrom";
import { SchemaNullable } from "../modifiers/SchemaNullable";
import { SchemaOptional } from "../modifiers/SchemaOptional";
import { SchemaReadonly } from "../modifiers/SchemaReadonly";
import { SchemaTag } from "../modifiers/SchemaTag";

/**
 * An embedding: a fixed-length list of numbers you can search by similarity.
 *
 * ```ts
 * const documentSchema = s.define('documents', {
 *     id: s.string().key().identity(),
 *     title: s.string(),
 *     embedding: s.vector(1536),
 * }).compile();
 *
 * const similar = await store.documents
 *     .nearest(x => x.embedding, queryEmbedding, 10)
 *     .toArrayAsync();
 * ```
 *
 * ## Why this is not `s.array(s.number())`
 *
 * By value it is exactly that, and every codegen handler treats the two the same on purpose —
 * a vector clones with a spread, compares by JSON and freezes like any other array. What an
 * array cannot carry is the DIMENSION COUNT, and a backend that stores vectors natively needs
 * it at DDL time: pgvector's column type is `vector(1536)`, not `vector`.
 *
 * So this exists to be RECOGNISED, not to behave differently. A backend that knows what a
 * vector is stores one; every other backend sees a list of numbers and stores JSON, which is
 * why the feature works everywhere rather than only on PostgreSQL.
 *
 * ## Dimensions are not enforced here
 *
 * `dimensions` is a declaration, and core never checks a value against it. The check belongs
 * where the cost of being wrong is paid: a backend with a native `vector(n)` column rejects a
 * mismatched write itself, with an error naming the column. Validating in core would duplicate
 * that on the backends that already do it and add a per-save array scan to the ones that
 * cannot use the information at all.
 *
 * ## Similarity is cosine, and it is not a filter
 *
 * `.nearest()` is an ordering plus a limit — it returns the closest rows, not the matching
 * ones. Distance itself is not exposed: the entity shape is fixed, and the ordering is what
 * callers act on. A backend with no vector support scores in memory, so the answer is the
 * same everywhere; only the amount of data read differs.
 */
export class SchemaVector<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {

    instance: T;
    type = SchemaTypes.Vector;
    private _schemaVector = true;

    constructor(dimensions: number) {
        super();

        if (Number.isInteger(dimensions) === false || dimensions <= 0) {
            // Thrown at schema construction rather than at the first save: a bad dimension
            // count is a typo in a declaration, and the stack is only useful next to it.
            throw new Error(`A vector needs a positive whole number of dimensions.  Received: ${dimensions}`);
        }

        this.dimensions = dimensions;
        this.instance = null as T;
    }

    from(propertyName: string) {
        return new SchemaFrom<T, TModifiers>(propertyName, this);
    }

    optional() {
        return new SchemaOptional<T, TModifiers | "optional">(this);
    }

    nullable() {
        return new SchemaNullable<T, TModifiers | "nullable">(this);
    }

    readonly() {
        return new SchemaReadonly<T, TModifiers | "readonly">(this);
    }

    default<I = never>(value: DefaultValue<T, I>, injected?: I) {
        return new SchemaDefault<T, I, TModifiers | "default">(value, injected, this);
    }

    tag(...tags: string[]) {
        return new SchemaTag<T, TModifiers>(tags, this);
    }
}
