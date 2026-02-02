import { IdType, SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaKey } from "./SchemaKey";
import { SchemaTag } from "./SchemaTag";

export class SchemaTracked<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {

    instance: T;
    private _schemaTracked = true;

    constructor(current: SchemaBase<T, TModifiers>) {
        super(current);
        this.instance = current.instance;
        this.isUnmapped = false;
    }

    key(): T extends IdType ? SchemaKey<T, TModifiers | "key"> : never {
        return new SchemaKey(this as SchemaBase<T & IdType, TModifiers>) as T extends IdType ? SchemaKey<T, TModifiers | "key"> : never;
    }

    tag(...tags: string[]) {
        return new SchemaTag<T, TModifiers>(tags, this);
    }
}