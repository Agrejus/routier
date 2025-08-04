import { SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";

export class SchemaIdentity<T, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {
    instance: T;
    private _schemaIdentity = true;

    constructor(current: SchemaBase<T, TModifiers>) {
        super(current);
        this.instance = current.instance;
        this.isIdentity = true;
    }
}