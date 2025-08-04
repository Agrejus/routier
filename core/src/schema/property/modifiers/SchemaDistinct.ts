import { SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";

export class SchemaDistinct<T extends any, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {

    instance: T;
    private _schemaDistinct = true;

    constructor(current: SchemaBase<T, TModifiers>) {
        super(current);
        this.instance = current.instance;
        this.isDistict = true;
    }
}