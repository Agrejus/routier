import { CallbackPartialResult, CallbackResult, PartialResultType, Result, ResultType } from '../../results';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, IdbPluginCollection } from '../types';
import { OperationsPayload, PersistPayload } from './types';
import { AsyncPipeline, TrampolinePipeline } from '../../pipeline';
import { ResolvedChanges } from '../../collections';
import { InferCreateType } from '../../schema';
import { DbPluginReplicator } from './DbPluginReplicator';
export class OptimisticDbPluginReplicator extends DbPluginReplicator {

    /**
     * Creates a new OptimisticDbPluginReplicator that coordinates operations between a source database and its replicas.
     * 
     * @param source The primary database plugin that will receive all operations first
     * @param replicas Additional database plugins that will replicate operations from the source
     * @returns A new DbPluginReplicator instance that manages the source-replica relationship
     */
    static create(plugins: Required<IdbPluginCollection>) {
        return new OptimisticDbPluginReplicator(plugins);
    }

    /**
     * Will query the read plugin if there is one, otherwise the source plugin will be queried
    */
    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<TShape>): void {
        try {

            const plugin = this.plugins.read != null ? this.plugins.read : this.plugins.source;

            plugin.query(event, done);
        } catch (e: any) {
            done(Result.error(e));
        }
    }

    destroy<TEntity extends {}>(event: DbPluginEvent<TEntity>, done: CallbackResult<never>): void {
        try {

            const pipeline = new AsyncPipeline<IDbPlugin, never>();
            const plugins = [this.plugins.source, ...this.plugins.replicas];

            for (let i = 0, length = plugins.length; i < length; i++) {
                pipeline.pipe(plugins[i], (plugin, done) => plugin.destroy(event, done));
            }

            pipeline.filter((result) => {

                if (result.ok === Result.ERROR) {
                    done(result);
                    return;
                }

                done(Result.success());
            });

        } catch (e: any) {
            done(Result.error(e));
        }
    }

    private _optimisticPersist<TEntity extends {}>(payload: PartialResultType<PersistPayload<TEntity>>, done: CallbackPartialResult<PersistPayload<TEntity>>) {

        if (payload.ok === Result.ERROR) {
            done(payload);
            return;
        }
        const { plugins, index, event } = payload.data;
        const plugin = plugins[index];

        // move next
        payload.data.index++;

        plugin.bulkPersist({
            operation: event.operation,
            schemas: event.schemas
        }, (r) => {

            if (r.ok === Result.ERROR) {
                done(r);
                return;
            }

            done(payload);
        });
    }

    bulkPersist<TEntity extends {}>(event: DbPluginBulkPersistEvent<TEntity>, done: CallbackPartialResult<ResolvedChanges<TEntity>>): void {
        try {

            const deferredPipeline = new TrampolinePipeline<ResultType<OperationsPayload>>();
            const deferredPlugins = [this.plugins.source, ... this.plugins.replicas];

            if (this.plugins.read == null) {
                throw new Error("Read plugin cannot be null or undefined for optimistic updates");
            }

            for (let i = 0, length = deferredPlugins.length; i < length; i++) {
                deferredPipeline.pipe<PersistPayload<TEntity>>(this._optimisticPersist.bind(this))
            }

            this.plugins.read.bulkPersist({
                operation: event.operation,
                schemas: event.schemas
            }, (r) => {

                if (r.ok !== Result.SUCCESS) {
                    done(r);
                    return;
                }

                // optimistically call done and still continue saving the rest of the data.  We read from the memory
                // db anyways
                done(r);

                // make sure we swap the adds here, that way we can make sure other persist events
                // don't take their additions and try to change subsequent calls
                const adds = r.data.result.adds();
                const schemaIds = new Set(adds.data.map(x => x[0]));

                for (const schemaId of schemaIds) {
                    const schemaOperations = event.operation.changes.get(schemaId);
                    schemaOperations.adds.entities = [];
                }

                for (const [schemaId, item] of adds.data) {
                    const schemaOperations = event.operation.changes.get(schemaId);

                    // replace additions on the event with the saved changes so 
                    // the rest of the plugins will get any additons who's id's have been set                   
                    schemaOperations.adds.entities.push(item as InferCreateType<TEntity>);
                }

                const data: PersistPayload<TEntity> = {
                    plugins: deferredPlugins,
                    index: 0,
                    event: {
                        operation: event.operation,
                        schemas: event.schemas
                    },
                    result: new ResolvedChanges()
                };

                setTimeout(() => {
                    deferredPipeline.filter<ResultType<PersistPayload<TEntity>>>({
                        data,
                        ok: Result.SUCCESS
                    }, (_) => {
                        // no-op for now, maybe implement retries?
                        console.log('I AM DONE!');
                    });
                }, 5);
            });

        } catch (e: any) {
            done(Result.error(e));
        }
    }
}