import { DbPluginBulkOperationsEvent, DbPluginQueryEvent, EntityModificationResult, IDbPlugin } from 'routier-core';

export class FileSystemPlugin implements IDbPlugin {

    private path: string;
    private name: string;

    constructor(path: string, name: string) {
        this.path = path;
        this.name = name;
    }

    query<TRoot extends {}, TShape extends unknown = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: (result: TShape, error?: any) => void): void {

    }

    destroy(done: (error?: any) => void): void {

    }

    bulkOperations<TRoot extends {}>(event: DbPluginBulkOperationsEvent<TRoot>, done: (result: EntityModificationResult<TRoot>, error?: any) => void): void {

    }

}