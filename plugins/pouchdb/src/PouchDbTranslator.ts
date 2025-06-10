import { assertIsArray, CompiledSchema, InferType, IQuery, JsonTranslator } from "routier-core";

export class PouchDbTranslator<TEntity extends {}, TShape extends unknown = TEntity> extends JsonTranslator<TEntity, TShape> {

    private schema: CompiledSchema<TEntity>;

    constructor(query: IQuery<TEntity, TShape>, schema: CompiledSchema<TEntity>) {
        super(query);
        this.schema = schema;
    }

    override translate(data: unknown): TShape {
        assertIsArray(data);

        // PouchDB converts a Date to a string when it is saved, we need to convert it back when it's selected
        const deserializedData = data.map(x => this.schema.serialize(x as InferType<TEntity>))

        return super.translate(deserializedData);
    }

}