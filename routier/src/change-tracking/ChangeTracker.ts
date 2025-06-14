import { ChangeTrackingType, CompiledSchema, EntityChanges, EntityModificationResult, Expression, InferCreateType, InferType } from "routier-core";
import { ResolveOptions } from "../data-access/types";
import { EntityCallbackMany } from "../types";
import { AdditionsPackage, IChangeTrackerStrategy } from "./types";
import { IdentityKeyChangeTrackingStrategy } from './strategies/IdentityKeyChangeTrackingStrategy';
import { NonIdentityKeyChangeTrackingStrategy } from './strategies/NonIdentityKeyChangeTrackingStrategy';

export class ChangeTracker<T extends {}> implements IChangeTrackerStrategy<T> {

    private readonly _strategy: IChangeTrackerStrategy<T>;

    constructor(strategy: IChangeTrackerStrategy<T>) {
        this._strategy = strategy;
    }

    getAndDestroyTags() {
        return this._strategy.getAndDestroyTags();
    }

    add(entities: InferCreateType<T>[], tag: unknown | null, done: EntityCallbackMany<T>) {
        return this._strategy.add(entities, tag, done);
    }

    remove(entities: InferType<T>[], tag: unknown | null, done: EntityCallbackMany<T>) {
        return this._strategy.remove(entities, tag, done);
    }

    removeByExpression(expression: Expression, tag: unknown | null, done: (error?: any) => void) {
        return this._strategy.removeByExpression(expression, tag, done);
    }

    resolve(entities: InferType<T>[], tag: unknown | null, options?: ResolveOptions) {
        return this._strategy.resolve(entities, tag, options);
    }

    hasChanges(): boolean {
        return this._strategy.hasChanges();
    }

    replace(existingEntity: InferType<T> | InferCreateType<T>, newEntity: InferType<T> | InferCreateType<T>) {
        return this._strategy.replace(existingEntity, newEntity);
    }

    enrich(entities: InferType<T>[]): InferType<T>[] {
        return this._strategy.enrich(entities);
    }

    prepareRemovals(): EntityChanges<T>["removes"] {
        if (this.hasChanges() === false) {
            return {
                entities: [],
                expression: null
            };
        }

        return this._strategy.prepareRemovals();
    }

    prepareAdditions() {
        return this._strategy.prepareAdditions();
    }

    getAttachmentsChanges(): EntityChanges<T>["updates"] {
        return this._strategy.getAttachmentsChanges();
    }

    mergeChanges(changes: EntityModificationResult<T>, addPackge: AdditionsPackage<T>) {
        this._strategy.mergeChanges(changes, addPackge);
    }

    clearAdditions() {
        this._strategy.clearAdditions();
    }

    instance(entities: InferCreateType<T>[], changeTrackingType: ChangeTrackingType) {
        return this._strategy.instance(entities, changeTrackingType);
    }

    detach(entities: InferType<T>[]) {
        return this._strategy.detach(entities);
    }

    private static _createStrategy<T extends {}>(schema: CompiledSchema<T>) {
        if (schema.hasIdentityKeys === true) {
            return new IdentityKeyChangeTrackingStrategy(schema)
        }

        return new NonIdentityKeyChangeTrackingStrategy(schema);
    }

    static create<T extends {}>(schema: CompiledSchema<T>) {
        const strategy = ChangeTracker._createStrategy<T>(schema);

        return new ChangeTracker<T>(strategy);
    }
}   