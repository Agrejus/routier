import { CompiledSchema, IdType, InferType, PropertyInfo, SchemaTypes } from "../schema";
import { Result } from "../results";
import { uuidv4 } from "../utilities";
import { IdSet } from "./IdSet";

export class MemoryDataCollection {

    protected readonly nextNumericalIds: Map<string, number>;
    protected readonly data: Map<string, Record<string, unknown>>;
    protected readonly schema: CompiledSchema<any>;
    protected readonly idProperties: PropertyInfo<any>[];

    get size() {
        return this.data.size;
    }

    get records() {
        return [...this.data.values()];
    }

    constructor(schema: CompiledSchema<any>) {
        this.data = new Map<string, Record<string, unknown>>();
        this.nextNumericalIds = new Map<string, number>();
        this.schema = schema;
        this.idProperties = schema.idProperties;
    }

    private _getNextId(property: PropertyInfo<any>) {

        let nextId = 1;

        if (this.nextNumericalIds.has(property.id) === true) {
            nextId = this.nextNumericalIds.get(property.id) + 1;
        }

        this.nextNumericalIds.set(property.id, nextId);

        return nextId;
    }

    private resolveId(property: PropertyInfo<any>, value: unknown) {
        if (typeof value !== "number") {
            return;
        }

        const currentIdForProperty = this.nextNumericalIds.get(property.id);

        if (value <= currentIdForProperty) {
            return;
        }

        this.nextNumericalIds.set(property.id, value);
    }

    private getAndSetId(item: Record<string, unknown>, property: PropertyInfo<any>): IdType {
        if (item[property.name] != null) {
            return item[property.name] as IdType;
        }

        if (property.type === SchemaTypes.String) {
            const uuid = uuidv4()
            item[property.name] = uuid;
            return uuid;
        }

        if (property.type === SchemaTypes.Number) {
            const id = this._getNextId(property);
            item[property.name] = id;
            return id;
        }

        throw new Error(`Id Property '${property.name}' must be string or number, found '${property.type}'`)
    }

    seed(items: Record<string, unknown>[]) {
        for (let i = 0, length = items.length; i < length; i++) {
            const id = this.resolveIdSet(items[i] as InferType<unknown>);
            this.data.set(id.toString(), items[i]);
        }
    }

    private resolveCurrentIdSet(item: Record<string, unknown>): IdSet {
        const idProperties = this.schema.idProperties;
        const ids: IdType[] = [];
        // ensure keys
        for (let j = 0, l = idProperties.length; j < l; j++) {
            const property = idProperties[j];
            const value = property.getValue(item);

            if (value == null) {
                throw new Error(`Key cannot be null.  Key: ${property.name}`);
            }

            ids.push(value);
        }

        return new IdSet(...ids);
    }

    private resolveIdSet(item: Record<string, unknown>): IdSet {

        if (this.schema.hasIdentityKeys) {
            const idProperties = this.schema.idProperties;
            const ids: IdType[] = new Array<IdType>(idProperties.length);

            // Need to make sure we allow for seeding the collection when we call add vs seed
            // There will be an existing id, but the id type could still be identity
            if (idProperties.length === 1) {
                const value = this.getAndSetId(item, idProperties[0]);
                this.resolveId(idProperties[0], value);
                ids[0] = value;
            } else {
                for (let j = 0, l = idProperties.length; j < l; j++) {
                    const value = this.getAndSetId(item, idProperties[j]);
                    this.resolveId(idProperties[j], value);
                    ids[j] = value;
                }
            }

            return new IdSet(...ids);
        }

        return this.resolveCurrentIdSet(item);
    }

    add(item: Record<string, unknown>) {
        const id = this.resolveIdSet(item);
        this.data.set(id.toString(), item);
    }

    remove(item: Record<string, unknown>) {
        const id = this.resolveCurrentIdSet(item);
        this.data.delete(id.toString());
    }

    update(item: Record<string, unknown>) {
        const id = this.resolveCurrentIdSet(item);
        this.data.set(id.toString(), item);
    }

    async destroy(): Promise<void> {
        this.nextNumericalIds.clear();
        this.data.clear();
    }

    async load(): Promise<void> {
        // No-op for memory collection
    }

    async save(): Promise<void> {
        // No-op for memory collection
    }
}