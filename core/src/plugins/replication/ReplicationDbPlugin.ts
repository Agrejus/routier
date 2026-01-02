import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ReplicationPluginOptions } from '../types';
import { BulkPersistResult } from '../../collections';
import { resolveBulkPersistChanges } from '../../utilities';
import { ITranslatedValue } from '../translators';

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
    async query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>): Promise<ITranslatedValue<TShape>> {
        const plugin = this.plugins.read != null ? this.plugins.read : this.plugins.source;
        return await plugin.query(event);
    }

    async destroy(event: DbPluginEvent): Promise<void> {
        const plugins = [this.plugins.source, ...this.plugins.replicas];

        for (const plugin of plugins) {
            await plugin.destroy(event);
        }
    }


    async bulkPersist(event: DbPluginBulkPersistEvent): Promise<BulkPersistResult> {
        // insert into the source first to generate any ids, then take the result and persist that into the replicas
        const plugins = [this.plugins.source, ...this.plugins.replicas];

        if (this.plugins.read != null) {
            plugins.push(this.plugins.read);
        }

        const result = new BulkPersistResult();

        for (let i = 0, length = plugins.length; i < length; i++) {
            const plugin = plugins[i];

            // source is first
            if (i === 0) {
                const sourceResult = await plugin.bulkPersist(event);

                // make sure we swap the adds here, that way we can make sure other persist events
                // don't take their additions and try to change subsequent calls
                resolveBulkPersistChanges(event, sourceResult, event.operation);
                continue;
            }

            await plugin.bulkPersist(event);
        }

        return result;
    }
}