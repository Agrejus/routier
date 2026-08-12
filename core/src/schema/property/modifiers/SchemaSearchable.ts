import { SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaNullable } from "./SchemaNullable";
import { SchemaOptional } from "./SchemaOptional";

/**
 * Marks a string property as eligible for a full-text search index.
 *
 * Eligible, not indexed. The schema says what COULD be indexed; the collection builder's
 * `.searchIndex()` says that it IS. A property marked here on a collection that never declares
 * an index costs nothing at all — no rows, no write amplification, no storage.
 *
 * Like `s.vector()`, this exists to be RECOGNISED rather than to behave. It changes nothing
 * about how the property is stored, cloned, compared, serialized or queried. The datastore
 * reads the flag off the compiled schema to decide which values to tokenise; every plugin is
 * unaware the property is any different from another string.
 *
 * Declared on `SchemaString` only, so `s.number().searchable()` is a compile error rather than
 * a runtime surprise. The one case the type system cannot catch — a searchable string nested
 * inside an `s.object()` — is rejected when the schema compiles: v1 indexes root-level string
 * properties only.
 */
export class SchemaSearchable<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {

    instance: T;
    private _schemaSearchable = true;

    constructor(current: SchemaBase<T, TModifiers>) {
        super(current);
        this.instance = current.instance;
        this.isSearchable = true;
    }

    /**
     * Declared here so `.searchable()` composes in BOTH senses — `.searchable().optional()` and
     * `.optional().searchable()` mean the same thing and both keep the flag. `SchemaDistinct`
     * exposes neither, which is why `.distinct().optional()` is unwritable and its copy-loss
     * (see `SchemaBase.isSearchable`) has never been noticed.
     */
    optional() {
        return new SchemaOptional<T, TModifiers | "optional">(this);
    }

    nullable() {
        return new SchemaNullable<T, TModifiers | "nullable">(this);
    }
}
