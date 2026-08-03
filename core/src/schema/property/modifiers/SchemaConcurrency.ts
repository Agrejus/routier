import { SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";

/**
 * Marks a number property as the row's optimistic-concurrency token.
 *
 * The datastore manages the value: it starts at 1 on add, and every update is applied
 * conditionally — "only if the stored value still matches what I read" — with the token
 * bumped on success. A save that lost the race fails with a concurrency error naming the
 * rows instead of silently overwriting another writer's data, which is the one failure
 * mode a data layer is never allowed to have.
 */
export class SchemaConcurrency<T extends number, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {

    instance: T;
    private _schemaConcurrency = true;

    constructor(current: SchemaBase<T, TModifiers>) {
        super(current);
        this.instance = current.instance;
        this.isConcurrency = true;

        // The token is system-managed: rows start at version 1 unless the caller
        // deliberately supplied their own default.
        if (this.defaultValue == null) {
            this.defaultValue = (() => 1) as any;
        }
    }
}
