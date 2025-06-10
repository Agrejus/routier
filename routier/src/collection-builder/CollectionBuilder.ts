import { CompiledSchema, IDbPlugin, SchemaParent } from 'routier-core';
import { Collection } from '../collections/Collection';
import { CollectionOptions, CollectionPipelines, StatefulCollectionOptions } from '../types';
import { CollectionInstanceCreator } from './types';
import { StatefulCollection } from '../collections/StatefulCollection';

type CollectionBuilderProps<TEntity extends {}, TCollecition extends Collection<TEntity>> = {
    onCollectionCreated: (collection: Collection<TEntity>) => void;
    schema: CompiledSchema<TEntity>;
    dbPlugin: IDbPlugin;
    isStateful: boolean;
    instanceCreator: CollectionInstanceCreator<TEntity, TCollecition>;
    pipelines: CollectionPipelines;
    signal: AbortSignal;
    stateful?: { optimistic: boolean }
    parent: SchemaParent;
}

export class CollectionBuilder<TEntity extends {}, TCollection extends Collection<TEntity>> {

    private _onCollectionCreated: (collection: Collection<TEntity>) => void;
    private readonly _schema: CompiledSchema<TEntity>;
    private readonly _dbPlugin: IDbPlugin;
    private _isStateful: boolean = false;
    private _instanceCreator: CollectionInstanceCreator<TEntity, TCollection>;
    private _pipelines: CollectionPipelines;
    private _signal: AbortSignal;
    private _statefulProps?: { optimistic: boolean }
    private parent: SchemaParent;

    constructor(props: CollectionBuilderProps<TEntity, TCollection>) {
        this._pipelines = props.pipelines;
        this._schema = props.schema;
        this._dbPlugin = props.dbPlugin;
        this._onCollectionCreated = props.onCollectionCreated;
        this._isStateful = props.isStateful;
        this._instanceCreator = props.instanceCreator;
        this._signal = props.signal;
        this._statefulProps = props.stateful;
        this.parent = props.parent;
    }

    /**
     * Optimistic will write data to the read plugin first making it available immediately, then
     * it will write that response to the source database asyncronously.  We optimistically
     * assume the write to the source database will succeed
     */
    stateful(options?: { optimistic?: boolean }) {
        this._isStateful = true;
        return new CollectionBuilder<TEntity, StatefulCollection<TEntity>>({
            dbPlugin: this._dbPlugin,
            isStateful: true,
            onCollectionCreated: this._onCollectionCreated,
            schema: this._schema,
            instanceCreator: StatefulCollection,
            pipelines: this._pipelines,
            signal: this._signal,
            stateful: {
                optimistic: options?.optimistic ?? false
            },
            parent: this.parent
        });
    }

    create(): TCollection;
    create<TExtension extends TCollection>(extend: (i: CollectionInstanceCreator<TEntity, TCollection>, dbPlugin: IDbPlugin, schema: CompiledSchema<TEntity>, options: CollectionOptions, pipelines: CollectionPipelines, parent: SchemaParent) => TExtension): TExtension;
    create<TExtension extends TCollection = never>(extend?: (i: CollectionInstanceCreator<TEntity, TCollection>, dbPlugin: IDbPlugin, schema: CompiledSchema<TEntity>, options: CollectionOptions, pipelines: CollectionPipelines, parent: SchemaParent) => TExtension) {

        const options: CollectionOptions = {
            stateful: this._isStateful,
            signal: this._signal,
        }

        if (this._isStateful === true) {
            (options as StatefulCollectionOptions).optimistic = this._statefulProps?.optimistic ?? false
        }

        if (extend == null) {
            const Instance = this._instanceCreator;
            const result = new Instance(this._dbPlugin, this._schema, options, this._pipelines, this.parent);

            this._onCollectionCreated(result);

            return result;
        }

        const Instance = this._instanceCreator;
        const extendedResult = extend(Instance, this._dbPlugin, this._schema, options, this._pipelines, this.parent);

        this._onCollectionCreated(extendedResult);

        return extendedResult;
    }
}