import { CompiledSchema, SchemaId } from "../schema";

/**
 * Collection of schemas with generic typing for type-safe schema retrieval
 */
export class SchemaCollection extends Map<SchemaId, CompiledSchema<Record<string, unknown>>> {

    override get<T>(schemaId: SchemaId) {
        return super.get(schemaId) as CompiledSchema<T>;
    }

}