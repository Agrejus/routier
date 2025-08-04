import { CallbackPartialResult, CallbackResult, PartialResultType, Result, ResultType } from '../../results';
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, IDbPlugin, IdbPluginCollection } from '../types';
import { OperationsPayload, PersistPayload } from './types';
import { TrampolinePipeline } from '../../pipeline';
import { ResolvedChanges } from '../../collections';
import { InferCreateType } from '../../schema';

export class DbPluginReplicator implements IDbPlugin {

    plugins: IdbPluginCollection;

    protected constructor(plugins: IdbPluginCollection) {
        this.plugins = plugins;
    }

    /**
     * Creates a new DbPluginReplicator that coordinates operations between a source database and its replicas.
     * 
     * @param source The primary database plugin that will receive all operations first
     * @param replicas Additional database plugins that will replicate operations from the source
     * @returns A new DbPluginReplicator instance that manages the source-replica relationship
     */
    static create(plugins: IdbPluginCollection) {
        return new DbPluginReplicator(plugins);
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

    destroy(done: CallbackResult<never>): void {
        try {

            const pipeline = new TrampolinePipeline<ResultType<OperationsPayload>>();
            const plugins = [this.plugins.source, ...this.plugins.replicas];
            const data: OperationsPayload = {
                plugins,
                index: 0
            };

            for (let i = 0, length = plugins.length; i < length; i++) {
                pipeline.pipe<OperationsPayload>(this.destroyDbs.bind(this))
            }

            pipeline.filter<ResultType<OperationsPayload>>({
                data,
                ok: Result.SUCCESS
            }, (result) => {

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

    protected destroyDbs(payload: ResultType<OperationsPayload>, done: CallbackResult<OperationsPayload>) {

        if (payload.ok === Result.ERROR) {
            done(payload);
            return;
        }

        const { plugins, index } = payload.data;
        const plugin = plugins[index];

        // move next
        payload.data.index++;

        plugin.destroy(done);
    }

    private _persist<TEntity extends {}>(payload: PartialResultType<PersistPayload<TEntity>>, done: CallbackPartialResult<PersistPayload<TEntity>>) {

        if (payload.ok === Result.ERROR) {
            done(payload)
            return;
        }

        const { plugins, index, event, result } = payload.data;
        const plugin = plugins[index];

        // move next
        payload.data.index++;

        // source is first
        if (payload.data.index === 1) {
            plugin.bulkPersist(event, (r) => {

                if (r.ok === Result.ERROR) {
                    done(r)
                    return;
                }

                // make sure we swap the adds here, that way we can make sure other persist events
                // don't take their additions and try to change subsequent calls
                const adds = r.data.result.adds();
                const schemaIds = new Set(adds.data.map(x => x[0]));

                for (const schemaId of schemaIds) {
                    const schemaOperations = payload.data.event.operation.changes.get(schemaId);
                    schemaOperations.adds.entities = [];
                }

                for (const [schemaId, item] of adds.data) {
                    const schemaOperations = payload.data.event.operation.changes.get(schemaId);

                    // replace additions on the event with the saved changes so 
                    // the rest of the plugins will get any additons who's id's have been set                   
                    schemaOperations.adds.entities.push(item as InferCreateType<TEntity>);
                }

                done(payload);
            });
            return;
        }

        if (result == null) {
            done(payload);
            return;
        }

        plugin.bulkPersist(event, (r) => {

            if (r.ok === Result.ERROR) {
                done(r)
                return;
            }

            done(payload);
        });
    }

    bulkPersist<TEntity extends {}>(event: DbPluginBulkPersistEvent<TEntity>, done: CallbackPartialResult<ResolvedChanges<TEntity>>): void {
        try {
            // insert into the source first to generate any ids, then take the result and persist that into the replicas
            const pipeline = new TrampolinePipeline<PartialResultType<PersistPayload<TEntity>>>();
            const plugins = [this.plugins.source, ...this.plugins.replicas];

            if (this.plugins.read != null) {
                plugins.push(this.plugins.read);
            }

            const result = event.operation.toResult();

            const data: PersistPayload<TEntity> = {
                plugins,
                index: 0,
                event,
                result
            };

            for (let i = 0, length = plugins.length; i < length; i++) {
                pipeline.pipe<PersistPayload<TEntity>>(this._persist.bind(this))
            }

            pipeline.filter<PartialResultType<PersistPayload<TEntity>>>({
                data,
                ok: Result.SUCCESS
            }, (result) => {

                if (result.ok === Result.ERROR) {
                    done(Result.error(result.error));
                    return;
                }

                if (result.ok === Result.PARTIAL) {
                    done(Result.partial(result.data.result, result.error));
                    return;
                }

                done(Result.success(result.data.result));
            });

        } catch (e: any) {
            done(Result.error(e));
        }
    }
}