import { IDataAccessStrategy } from "../types";
import { DataAccessStrategyBase } from "./DataAccessStrategyBase";
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, ITranslatedValue } from "@routier/core/plugins";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from "@routier/core/results";
import { BulkPersistResult } from "@routier/core/collections";
import { applyFromResult, prepareFilters, schemaCollectionView, schemaView, transformedProperties } from "../../transforms";

export class DatabaseDataAccessStrategy<T extends {}> extends DataAccessStrategyBase<T> implements IDataAccessStrategy<T> {

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>) {
        super._bulkPersist(event, done);
    }

    /**
     * Runs the schema's transforms around the plugin's query.
     *
     * On the way down, a filter touching a transformed property is rewritten to compare
     * against the stored form — or rejected, when the transform is not deterministic and no
     * comparison could be correct. On the way back, `from` restores the values.
     *
     * A schema with no transforms takes none of this: the event is passed through untouched.
     */
    query<TShape>(event: DbPluginQueryEvent<T, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>) {
        const properties = transformedProperties(event.operation.schema);

        if (properties.length === 0) {
            this.dbPlugin.query<T, TShape>(event, done);
            return;
        }

        const viewed = {
            ...event,
            schemas: schemaCollectionView(event.schemas),
            operation: Object.create(
                Object.getPrototypeOf(event.operation),
                {
                    ...Object.getOwnPropertyDescriptors(event.operation),
                    schema: { value: schemaView(event.operation.schema), enumerable: true },
                }
            ),
        } as DbPluginQueryEvent<T, TShape>;

        prepareFilters(event, properties)
            .then(() => this.dbPlugin.query<T, TShape>(viewed, result => {
                if (result.ok === "error") {
                    done(result);
                    return;
                }

                applyFromResult(result.data, properties)
                    .then(() => done(result))
                    .catch(error => done(PluginEventResult.error(event.id, error)));
            }))
            .catch(error => done(PluginEventResult.error(event.id, error)));
    }
}
