// import { describe, it, expect, vi } from 'vitest';
// import { DbPluginReplicator } from './DbPluginReplicator';
// import { IdbPluginCollection } from '../types';
// import { Result } from '../../common/Result';

// const mockPlugins: IdbPluginCollection = {
//     source: { destroy: (cb: any) => cb(), query: () => { }, bulkPersist: () => { } },
//     replicas: [],
//     read: null
// };

// describe('DbPluginReplicator', () => {
//     it('should create an instance with the provided plugins', () => {
//         const replicator = DbPluginReplicator.create(mockPlugins);
//         expect(replicator).toBeInstanceOf(DbPluginReplicator);
//         expect(replicator.plugins).toBe(mockPlugins);
//     });

//     it('should call source.query if no read plugin is present', () => {
//         const queryEvent = { test: true };
//         const result = { foo: 'bar' };
//         const sourceQuery = vi.fn((event, done) => done(result));
//         const plugins = { ...mockPlugins, source: { ...mockPlugins.source, query: sourceQuery } };
//         const replicator = DbPluginReplicator.create(plugins);
//         let callbackResult: any = null;
//         replicator.query(queryEvent as any, (res) => { callbackResult = res; });
//         expect(sourceQuery).toHaveBeenCalledWith(queryEvent, expect.any(Function));
//         expect(callbackResult).toBe(result);
//     });

//     it('should call read.query if read plugin is present', () => {
//         const queryEvent = { test: true };
//         const result = { foo: 'bar' };
//         const sourceQuery = vi.fn((event, done) => done(result));
//         const readQuery = vi.fn((event, done) => done(result));
//         const plugins = { ...mockPlugins, source: { ...mockPlugins.source, query: sourceQuery }, read: { query: readQuery, destroy: (cb: any) => cb(), bulkOperations: () => { } } };
//         const replicator = DbPluginReplicator.create(plugins);
//         let callbackResult: any = null;
//         replicator.query(queryEvent as any, (res) => { callbackResult = res; });
//         expect(readQuery).toHaveBeenCalledWith(queryEvent, expect.any(Function));
//         expect(sourceQuery).not.toHaveBeenCalled();
//         expect(callbackResult).toBe(result);
//     });

//     it('should call destroy on all plugins successfully', async () => {
//         const sourceDestroy = vi.fn((cb) => cb());
//         const replica1Destroy = vi.fn((cb) => cb());
//         const replica2Destroy = vi.fn((cb) => cb());
//         const plugins = {
//             ...mockPlugins,
//             source: { ...mockPlugins.source, destroy: sourceDestroy },
//             replicas: [
//                 { destroy: replica1Destroy, query: () => { }, bulkOperations: () => { } },
//                 { destroy: replica2Destroy, query: () => { }, bulkOperations: () => { } }
//             ]
//         };
//         const replicator = DbPluginReplicator.create(plugins);
//         let callbackCalled = false;
//         await new Promise<void>((resolve) => {
//             replicator.destroy(() => {
//                 callbackCalled = true;
//                 resolve();
//             });
//         });
//         expect(sourceDestroy).toHaveBeenCalled();
//         expect(replica1Destroy).toHaveBeenCalled();
//         expect(replica2Destroy).toHaveBeenCalled();
//         expect(callbackCalled).toBe(true);
//     });

//     it('should call bulkOperations on source and replicas, returning the source result', async () => {
//         const sourceResult: any = { adds: [{ id: 1 }], removedCount: 0, updates: [] };
//         const sourceBulk = vi.fn((event, cb) => cb(sourceResult));
//         const replica1Bulk = vi.fn((event, cb) => cb(sourceResult));
//         const replica2Bulk = vi.fn((event, cb) => cb(sourceResult));
//         const plugins = {
//             ...mockPlugins,
//             source: { ...mockPlugins.source, bulkOperations: sourceBulk },
//             replicas: [
//                 { destroy: vi.fn(), query: vi.fn(), bulkOperations: replica1Bulk },
//                 { destroy: vi.fn(), query: vi.fn(), bulkOperations: replica2Bulk }
//             ]
//         };
//         const replicator = DbPluginReplicator.create(plugins);
//         const event: any = { operation: { adds: [], updates: [], removes: [], tags: [] }, parent: null, schema: null };
//         let callbackResult: any = null;
//         await new Promise<void>((resolve) => {
//             replicator.bulkPersist(event as any, (result) => {
//                 callbackResult = result;
//                 resolve();
//             });
//         });
//         expect(sourceBulk).toHaveBeenCalled();
//         expect(replica1Bulk).toHaveBeenCalled();
//         expect(replica2Bulk).toHaveBeenCalled();
//         expect(callbackResult).toBe(sourceResult);
//     });

//     it('should return errors if any plugin fails in bulkOperations', async () => {
//         const sourceResult: any = { adds: [{ id: 1 }], removedCount: 0, updates: [] };
//         const sourceBulk = vi.fn((event, cb) => cb(sourceResult));
//         const replica1Bulk = vi.fn((event, cb) => cb(sourceResult, 'replica1 error'));
//         const replica2Bulk = vi.fn((event, cb) => cb(sourceResult));
//         const plugins = {
//             ...mockPlugins,
//             source: { ...mockPlugins.source, bulkOperations: sourceBulk },
//             replicas: [
//                 { destroy: vi.fn(), query: vi.fn(), bulkOperations: replica1Bulk },
//                 { destroy: vi.fn(), query: vi.fn(), bulkOperations: replica2Bulk }
//             ]
//         };
//         const replicator = DbPluginReplicator.create(plugins);
//         const event: any = { operation: { adds: [], updates: [], removes: [], tags: [] }, parent: null, schema: null };
//         let callbackResult: any = null;
//         let callbackError: any = null;
//         await new Promise<void>((resolve) => {
//             replicator.bulkPersist(event as any, (result) => {

//                 if (result.ok === Result.SUCCESS) {
//                     callbackResult = result.data;
//                 } else {
//                     callbackError = result.error;
//                 }

//                 resolve();
//             });
//         });
//         expect(sourceBulk).toHaveBeenCalled();
//         expect(replica1Bulk).toHaveBeenCalled();
//         expect(replica2Bulk).toHaveBeenCalled();
//         expect(callbackResult).toBe(sourceResult);
//         expect(callbackError).toContain('replica1 error');
//     });
// }); 