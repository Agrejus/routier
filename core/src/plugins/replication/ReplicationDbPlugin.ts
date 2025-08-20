import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '../../results';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ReplicationPluginOptions } from '../types';
import { AsyncPipeline, WorkPipeline } from '../../pipeline';
import { ResolvedChanges } from '../../collections';
import { InferCreateType } from '../../schema';

export class ReplicationDbPlugin implements IDbPlugin {

    plugins: ReplicationPluginOptions;

    protected constructor(plugins: ReplicationPluginOptions) {
        this.plugins = plugins;
    }

    /**
     * Creates a new DbPluginReplicator that coordinates operations between a source database and its replicas.
     * 
     * @param source The primary database plugin that will receive all operations first
     * @param replicas Additional database plugins that will replicate operations from the source
     * @returns A new DbPluginReplicator instance that manages the source-replica relationship
     */
    static create(plugins: ReplicationPluginOptions) {
        return new ReplicationDbPlugin(plugins);
    }

    /**
     * Will query the read plugin if there is one, otherwise the source plugin will be queried
    */
    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<TShape>): void {
        try {

            const plugin = this.plugins.read != null ? this.plugins.read : this.plugins.source;

            plugin.query(event, done);
        } catch (e: any) {
            done(PluginEventResult.error(event.id, e));
        }
    }

    destroy<TEntity extends {}>(event: DbPluginEvent<TEntity>, done: PluginEventCallbackResult<never>): void {
        try {

            const pipeline = new AsyncPipeline<IDbPlugin, never>();
            const plugins = [this.plugins.source, ...this.plugins.replicas];

            for (let i = 0, length = plugins.length; i < length; i++) {
                pipeline.pipe(plugins[i], (plugin, done) => plugin.destroy(event, done));
            }

            pipeline.filter((result) => {

                if (result.ok === Result.ERROR) {
                    done(PluginEventResult.error(event.id, result.error));
                    return;
                }

                done(PluginEventResult.success(event.id));
            });

        } catch (e: any) {
            done(PluginEventResult.error(event.id, e));
        }
    }


    bulkPersist<TEntity extends {}>(event: DbPluginBulkPersistEvent<TEntity>, done: PluginEventCallbackPartialResult<ResolvedChanges<TEntity>>): void {
        try {
            // insert into the source first to generate any ids, then take the result and persist that into the replicas
            const pipeline = new WorkPipeline();
            const plugins = [this.plugins.source, ...this.plugins.replicas];

            if (this.plugins.read != null) {
                plugins.push(this.plugins.read);
            }

            const result = event.operation.toResult();

            for (let i = 0, length = plugins.length; i < length; i++) {
                pipeline.pipe((d) => {

                    const { changes } = event.operation;
                    const plugin = plugins[i];

                    // source is first
                    if (i === 0) {
                        plugin.bulkPersist(event, (r) => {

                            if (r.ok === Result.ERROR) {
                                d(r)
                                return;
                            }

                            // make sure we swap the adds here, that way we can make sure other persist events
                            // don't take their additions and try to change subsequent calls
                            const adds = r.data.result.adds();
                            const schemaIds = new Set(adds.data.map(x => x[0]));

                            for (const schemaId of schemaIds) {
                                debugger;
                                const persistResult = r.data.result.get(schemaId);
                                result.result.set(schemaId, persistResult);

                                const schemaOperations = changes.get(schemaId);
                                schemaOperations.adds.entities = [];
                            }

                            for (const [schemaId, item] of adds.data) {
                                const schemaOperations = changes.get(schemaId);

                                // replace additions on the event with the saved changes so 
                                // the rest of the plugins will get any additons who's id's have been set                   
                                schemaOperations.adds.entities.push(item as InferCreateType<TEntity>);
                            }

                            d(Result.success());
                        });
                        return;
                    }

                    plugin.bulkPersist(event, (r) => {

                        if (r.ok === Result.ERROR) {
                            d(r)
                            return;
                        }

                        d(Result.success());
                    });
                })
            }

            pipeline.filter((result) => {

                if (result.ok === Result.ERROR) {
                    done(PluginEventResult.error(event.id, result.error));
                    return;
                }

                // if (result.ok === Result.PARTIAL) {
                //     done(PluginEventResult.partial(event.id, result.data.result, result.error));
                //     return;
                // }

                done(PluginEventResult.success(event.id, result));
            });

        } catch (e: any) {
            done(PluginEventResult.error(event.id, e));
        }
    }
}