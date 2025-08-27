import { CompiledSchema, SchemaId } from "../schema";

/**
 * Collection of schemas with generic typing for type-safe schema retrieval
 */
export class SchemaCollection extends Map<SchemaId, CompiledSchema<Record<string, unknown>>> {

    override get<T>(schemaId: SchemaId) {
        return super.get(schemaId) as CompiledSchema<T>;
    }

    getByName<T>(collectionName: string): CompiledSchema<T> | undefined {
        const found = [...this].find(x => x[1].collectionName === collectionName);

        if (found != null) {
            return found[1] as CompiledSchema<T>;
        }

        return undefined;
    }

}