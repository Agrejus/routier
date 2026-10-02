import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import { IDbPlugin, Query } from '@routier/core/plugins';
import { Result } from '@routier/core/results';
import { InferRoot, InferType, s } from '@routier/core/schema';
import { logger, uuid } from '@routier/core/utilities';

const KIND = 'routier-swr-validator';

const validatorSchema = s.define('_routier_swr_validators', {
    _id: s.string().key(),
    kind: s.string(KIND),
    etag: s.string(),
    rowCount: s.number(),
}).compile();

type Validator = InferType<typeof validatorSchema>;
type ValidatorRoot = InferRoot<typeof validatorSchema>;
type RowCounter = () => Promise<number | null>;

const parseValidator = (row: unknown): Validator | null => {
    const candidate: object = Object(row);
    const id = String(Reflect.get(candidate, '_id'));
    const kind = Reflect.get(candidate, 'kind');
    const etag = Reflect.get(candidate, 'etag');
    const rowCount = Reflect.get(candidate, 'rowCount');

    return kind === KIND && typeof etag === 'string' && typeof rowCount === 'number'
        ? { _id: id, kind, etag, rowCount }
        : null;
};

export class ConditionalRevalidation {
    private readonly store: IDbPlugin;
    private loaded: Promise<Map<string, Validator>> | null = null;

    constructor(store: IDbPlugin) {
        this.store = store;
    }

    async ifNoneMatch(cacheKey: string, countRows: RowCounter): Promise<string | null> {
        const validator = (await this.load()).get(cacheKey);

        if (validator == null) {
            return null;
        }

        return validator.rowCount === await countRows() ? validator.etag : null;
    }

    async remember(cacheKey: string, etag: string | null, countRows: RowCounter): Promise<void> {
        const validators = await this.load();
        const previous = validators.get(cacheKey);

        if (etag == null) {
            if (previous != null) {
                validators.delete(cacheKey);
                await this.persist({ removes: [previous] });
            }

            return;
        }

        const rowCount = await countRows();

        if (rowCount == null) {
            return;
        }

        const validator: Validator = { _id: cacheKey, kind: KIND, etag, rowCount };
        validators.set(cacheKey, validator);
        await this.persist(previous == null ? { adds: [validator] } : { updates: [validator] });
    }

    async forget(prefix: string): Promise<void> {
        const validators = await this.load();
        const forgotten = Array.from(validators.values()).filter(validator => validator._id.startsWith(prefix));

        for (const validator of forgotten) {
            validators.delete(validator._id);
        }

        if (forgotten.length > 0) {
            await this.persist({ removes: forgotten });
        }
    }

    private load(): Promise<Map<string, Validator>> {
        this.loaded ??= this.read().catch((error: Error) => {
            logger.warn('[HttpSwrDbPlugin] could not read stored etags', { error });
            this.loaded = null;
            return new Map<string, Validator>();
        });

        return this.loaded;
    }

    private read(): Promise<Map<string, Validator>> {
        return new Promise((resolve, reject) => {
            this.store.query({
                id: uuid(8),
                schemas: this.schemas(),
                source: 'ConditionalRevalidation',
                action: 'query',
                explain: false,
                executedQueries: [],
                operation: Query.EMPTY<ValidatorRoot, ValidatorRoot>(validatorSchema),
            }, (result) => {
                if (result.ok === Result.ERROR) {
                    reject(result.error);
                    return;
                }

                const validators = new Map<string, Validator>();
                result.data.forEach((row) => {
                    const validator = parseValidator(row);

                    if (validator != null) {
                        validators.set(validator._id, validator);
                    }
                });
                resolve(validators);
            });
        });
    }

    private persist(changes: { adds?: Validator[], updates?: Validator[], removes?: Validator[] }): Promise<void> {
        const operation = new BulkPersistChanges();
        const schemaChanges = operation.resolve<ValidatorRoot>(validatorSchema.id);
        schemaChanges.adds.push(...(changes.adds ?? []));
        schemaChanges.updates.push(...(changes.updates ?? []).map(entity => ({ entity, changeType: 'markedDirty' as const, delta: {} })));
        schemaChanges.removes.push(...(changes.removes ?? []));

        return new Promise((resolve) => {
            this.store.bulkPersist({
                id: uuid(8),
                schemas: this.schemas(),
                source: 'ConditionalRevalidation',
                action: 'persist',
                operation,
            }, (result) => {
                if (result.ok === Result.ERROR) {
                    logger.warn('[HttpSwrDbPlugin] could not store etag', { error: result.error });
                }

                resolve();
            });
        });
    }

    private schemas(): SchemaCollection {
        return new SchemaCollection().set(validatorSchema.id, validatorSchema);
    }
}
