import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import { IDbPlugin, Query } from '@routier/core/plugins';
import { Result } from '@routier/core/results';
import { InferRoot, InferType, s } from '@routier/core/schema';
import { logger, uuid } from '@routier/core/utilities';

const validatorSchema = s.define('_routier_swr_validators', {
    cacheKey: s.string().key(),
    etag: s.string(),
    rowCount: s.number(),
}).compile();

type Validator = InferType<typeof validatorSchema>;
type ValidatorRoot = InferRoot<typeof validatorSchema>;

const hasEtag = (row: unknown): row is Validator => typeof Reflect.get(Object(row), 'etag') === 'string';

export class ConditionalRevalidation {
    private readonly store: IDbPlugin;
    private loaded: Promise<Map<string, Validator>> | null = null;

    constructor(store: IDbPlugin) {
        this.store = store;
    }

    async ifNoneMatch(cacheKey: string, localRowCount: number | null): Promise<string | null> {
        const validator = (await this.load()).get(cacheKey);
        return validator != null && validator.rowCount === localRowCount ? validator.etag : null;
    }

    async remember(cacheKey: string, etag: string | null, localRowCount: number): Promise<void> {
        const validators = await this.load();
        const previous = validators.get(cacheKey);
        const changes = new BulkPersistChanges();
        const schemaChanges = changes.resolve<ValidatorRoot>(validatorSchema.id);

        if (etag == null) {
            if (previous == null) {
                return;
            }

            validators.delete(cacheKey);
            schemaChanges.removes.push(previous);
        } else {
            const validator = { cacheKey, etag, rowCount: localRowCount };
            validators.set(cacheKey, validator);

            if (previous == null) {
                schemaChanges.adds.push(validator);
            } else {
                schemaChanges.updates.push({ entity: validator, changeType: 'markedDirty', delta: {} });
            }
        }

        await this.persist(changes);
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
                    if (hasEtag(row)) {
                        validators.set(row.cacheKey, row);
                    }
                });
                resolve(validators);
            });
        });
    }

    private persist(operation: BulkPersistChanges): Promise<void> {
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
