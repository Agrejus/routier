import { SchemaBase } from "../property/base/SchemaBase";
import { SchemaTracked } from '../property/modifiers/SchemaTracked';
import { SchemaModifiers, SchemaTypes } from "../types";

export class SchemaComputed<T extends any, I, TModifiers extends SchemaModifiers = "computed"> extends SchemaBase<T, TModifiers> {
    instance: T;
    type = SchemaTypes.Computed;
    private _schemaComputed = true;

    constructor(fn: T, injected: I, current?: SchemaBase<T, TModifiers>) {
        super(current);
        this.injected = injected;
        this.isUnmapped = true;
        this.functionBody = fn as any;
    }

    tracked() {
        return new SchemaTracked<T, TModifiers>(this);
    }
}