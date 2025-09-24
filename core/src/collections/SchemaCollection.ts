import { CompiledSchema, SchemaId } from "../schema";
import { ReadonlySchemaCollection } from "./ReadonlySchemaCollection";

/**
 * Collection of schemas with generic typing for type-safe schema retrieval
 */
export class SchemaCollection extends ReadonlySchemaCollection {

    set<T>(schemaId: SchemaId, schema: CompiledSchema<T>): this {
        this.data.set(schemaId, schema as CompiledSchema<Record<string, unknown>>);
        return this;
    }

    delete(schemaId: SchemaId): boolean {
        return this.data.delete(schemaId);
    }

    clear(): void {
        this.data.clear();
    }
}