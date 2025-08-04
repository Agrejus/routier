import { SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";
import { SchemaOptional } from "./SchemaOptional";

export class SchemaNullable<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {
    instance: T;
    private _schemaNullable = true;

    constructor(current: SchemaBase<T, TModifiers>) {
        super(current);
        this.instance = current.instance;
        this.isNullable = true;
    }

    optional() {
        return new SchemaOptional<T, TModifiers | "optional">(this);
    }
}