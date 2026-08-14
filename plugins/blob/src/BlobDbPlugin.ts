import { SchemaTypes } from '@routier/core/schema';
import type { CompiledSchema, PropertyInfo } from '@routier/core/schema';
import type {
    DbPluginBulkPersistEvent,
    DbPluginEvent,
    DbPluginQueryEvent,
    IDbPlugin,
    ITranslatedValue,
} from '@routier/core/plugins';
import { PluginEventResult, type PluginEventCallbackPartialResult, type PluginEventCallbackResult } from '@routier/core/results';
import type { BulkPersistResult } from '@routier/core/collections';
import type { Files } from './files';
import type { FileReference } from './schema';

/**
 * Turns file content into a file reference on the way to your real plugin.
 *
 * `s.file()` accepts content and stores a reference. This is what performs that swap, and it
 * is the only place it can happen: the generated `preprocess` is synchronous and is called
 * from the change tracker and the broadcast path, so it cannot await an upload. `bulkPersist`
 * can.
 *
 * ```ts
 * class AppStore extends DataStore {
 *     documents = this.collection(documentSchema).proxy().create();
 *     constructor() {
 *         super(new BlobDbPlugin(new DexiePlugin('app'), files));
 *     }
 * }
 *
 * await store.documents.addAsync({ title: 'Q3', file: fileFromInput });
 * await store.saveChangesAsync();   // uploads, then writes the row
 * ```
 *
 * ## Uploads happen before the rows, and are not part of their transaction
 *
 * They cannot be. A blob store has no transaction to enlist in, so "both or neither" is not
 * available at any price. What this does instead is order the failure: content is uploaded
 * first, and only then are the rows handed to the inner plugin inside its own transaction. A
 * save that fails after an upload leaves an orphan, which costs storage and breaks nothing
 * and `sweepOrphans` collects. The other order would leave a row pointing at bytes that were
 * never written.
 *
 * Uploads are idempotent because keys are content-addressed, so a retried save re-uploads
 * nothing.
 */
export type FileUploader = Pick<Files, 'upload'>;

export class BlobDbPlugin<TFiles extends FileUploader = Files> implements IDbPlugin {

    constructor(
        private readonly plugin: IDbPlugin,
        public readonly files: TFiles
    ) { }

    get databaseName(): string {
        return this.plugin.databaseName;
    }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        // Nothing to do. What comes back is already a reference: the stored shape and the read
        // shape are the same, and only the WRITE shape differs.
        this.plugin.query(event, done);
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        // Deliberately does not touch the blob store. Two records can reference one object, and
        // more than one database can reference one store, so destroying a database must not
        // delete bytes. Reclaim with `sweepOrphans`.
        this.plugin.destroy(event, done);
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        this.uploadPendingContent(event)
            .then(() => this.plugin.bulkPersist(event, done))
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }

    /**
     * Replaces every pending content value in the event with the reference it uploads to.
     *
     * Mutates the entities in place, which is what lets the inner plugin stay entirely
     * unaware that files exist: by the time it runs, a file property holds five plain fields.
     */
    private async uploadPendingContent(event: DbPluginBulkPersistEvent): Promise<void> {
        for (const [schemaId, changes] of event.operation) {

            if (!changes || changes.hasItems === false) {
                continue;
            }

            const schema = event.schemas.get(schemaId);
            const properties = fileProperties(schema);

            if (properties.length === 0) {
                continue;
            }

            for (const property of properties) {
                for (const entity of changes.adds as Record<string, unknown>[]) {
                    await this.resolve(entity, property);
                }

                // An update carries the changed entity under `entity`; a file that was not
                // touched is already a reference and resolves to itself.
                for (const update of changes.updates as { entity: Record<string, unknown> }[]) {
                    await this.resolve(update.entity, property);
                }
            }
        }
    }

    /** Uploads one property of one entity, if it is holding content rather than a reference. */
    private async resolve(entity: Record<string, unknown>, property: PropertyInfo<any>): Promise<void> {
        const value = entity[property.name];

        if (value == null || isFileReference(value)) {
            return;
        }

        entity[property.name] = await this.files.upload(value as never);
    }
}

/**
 * Whether a value is already a stored reference rather than content waiting to be uploaded.
 *
 * Checked structurally on `key` and `checksum` together. A `Blob` has neither; a reference
 * read back from the database has both. Testing one alone would misread any object that
 * happens to carry a `key`.
 */
export const isFileReference = (value: unknown): value is FileReference => {
    const candidate = value as Partial<FileReference> | null;

    return candidate != null
        && typeof candidate.key === 'string'
        && typeof candidate.checksum === 'string';
};

/** Every file property of a schema. Roots only; a file is a leaf and has no children. */
export const fileProperties = <T extends {}>(schema: CompiledSchema<T>): PropertyInfo<T>[] =>
    schema.properties.filter(property => property.type === SchemaTypes.File);
