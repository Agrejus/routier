import { DefaultValue, ForeignKey, FunctionBody, PropertyDeserializer, PropertySerializer, SchemaModifiers, SchemaTypes, PropertyTransform } from "../../types";

export abstract class SchemaBase<T extends any, TModifiers extends SchemaModifiers> {

    abstract instance: T;
    modifiers: TModifiers;

    isNullable: boolean = false;
    isUnmapped: boolean = false;
    isOptional: boolean = false;
    isKey: boolean = false;
    isIdentity: boolean = false;
    isReadonly: boolean = false;
    isDistict: boolean = false;
    /**
     * Set by `.modify(x => x.transform(...))`. A live reference, never stringified.
     * `null` when the property is stored as it is.
     */
    transform: PropertyTransform<unknown> | null = null;
    indexes: string[] = [];
    fromPropertyName: string | null = null;
    /**
     * How many numbers a vector holds. `null` for every other type.
     *
     * Declared here rather than on `SchemaVector` because a modifier WRAPS rather than
     * extends: `s.vector(1536).optional()` is a `SchemaOptional`, and anything reachable only
     * through the original class is lost the moment a modifier is added. `type` survives for
     * exactly this reason — the copy constructor below carries it — and a dimension count has
     * to travel with it, or an optional vector reaches a backend as a vector of unknown width
     * and cannot be given a column.
     *
     * `innerSchema` is the cautionary example: it lives on `SchemaArray` alone, so a modified
     * array arrives with no element type and clones through the slow path.
     */
    dimensions: number | null = null;

    foreignKeyDefinition: ForeignKey<unknown> | null = null;
    tags: string[] = [];
    injected: any = null;
    defaultValue: DefaultValue<T> | null = null;
    valueSerializer: PropertySerializer<T> | null = null;
    valueDeserializer: PropertyDeserializer<T> | null = null;
    type: SchemaTypes;
    functionBody: FunctionBody<any, T> | null;
    private _schemaBase = true;
    readonly literals: T[] = [];

    constructor(entity?: SchemaBase<T, TModifiers>, literals?: T[]) {

        if (entity != null) {
            this.valueSerializer = entity.valueSerializer;
            this.valueDeserializer = entity.valueDeserializer;
            this.functionBody = entity.functionBody;
            this.isNullable = entity.isNullable;
            this.isOptional = entity.isOptional;
            this.isKey = entity.isKey;
            this.isIdentity = entity.isIdentity;
            this.isReadonly = entity.isReadonly;
            this.defaultValue = entity.defaultValue;
            this.type = entity.type;
            this.injected = entity.injected;
            this.indexes = entity.indexes;
            this.fromPropertyName = entity.fromPropertyName;
            this.tags = entity.tags;
            this.transform = entity.transform;
            this.dimensions = entity.dimensions;
        }

        if (literals) {
            this.literals = literals;
        }
    }
}