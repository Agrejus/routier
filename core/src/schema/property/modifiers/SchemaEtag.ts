import { EtagComparator, EtagValue, SchemaModifiers } from "../../types";
import { SchemaBase } from "../base/SchemaBase";

export class SchemaEtag<T extends EtagValue, TModifiers extends SchemaModifiers> extends SchemaBase<T, TModifiers> {

    instance: T;
    private readonly comparator: EtagComparator<T>;

    constructor(comparator: EtagComparator<T>, current: SchemaBase<T, TModifiers>) {
        super(current);
        this.instance = current.instance;
        this.comparator = comparator;
        this.isEtag = true;
        this.etagComparator = comparator;
    }

    optional(): SchemaEtag<T, TModifiers | "optional"> {
        const next = new SchemaEtag<T, TModifiers | "optional">(this.comparator, this);
        next.isOptional = true;
        return next;
    }

    nullable(): SchemaEtag<T, TModifiers | "nullable"> {
        const next = new SchemaEtag<T, TModifiers | "nullable">(this.comparator, this);
        next.isNullable = true;
        return next;
    }
}
