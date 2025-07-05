// import { describe, it, expect, beforeEach, vi } from 'vitest';
// import { ChangeTracker } from './ChangeTracker';
// import { UnknownKeyChangeTrackingStrategy } from './strategies/UnknownKeyChangeTrackingStrategy';
// import { KnownKeyChangeTrackingStrategy } from './strategies/KnownKeyChangeTrackingStrategy';

// describe('ChangeTracker', () => {
//     let mockSchema: any;
//     let mockStrategy: any;

//     beforeEach(() => {
//         mockSchema = {
//             prepare: (entity: any) => entity,
//             hash: (entity: any) => JSON.stringify(entity),
//             enrich: (entity: any) => entity,
//             getId: (entity: any) => entity.id,
//             properties: []
//         };

//         mockStrategy = {
//             getAndDestroyTags: vi.fn(),
//             markDirty: vi.fn(),
//             isAttached: vi.fn(),
//             filterAttached: vi.fn(),
//             getAttached: vi.fn(),
//             add: vi.fn(),
//             remove: vi.fn(),
//             removeByQuery: vi.fn(),
//             resolve: vi.fn(),
//             hasChanges: vi.fn(),
//             replace: vi.fn(),
//             enrich: vi.fn(),
//             prepareRemovals: vi.fn(),
//             prepareAdditions: vi.fn(),
//             getAttachmentsChanges: vi.fn(),
//             mergeChanges: vi.fn(),
//             clearAdditions: vi.fn(),
//             instance: vi.fn(),
//             detach: vi.fn()
//         };
//     });

//     it('should create IdentityKeyChangeTrackingStrategy when schema has identity keys', () => {
//         mockSchema.hasIdentityKeys = true;
//         const tracker = ChangeTracker.create(mockSchema);

//         expect(tracker).toBeInstanceOf(ChangeTracker);
//         expect(tracker.hasChanges()).toBe(false);
//     });

//     it('should create NonIdentityKeyChangeTrackingStrategy when schema does not have identity keys', () => {
//         mockSchema.hasIdentityKeys = false;
//         const tracker = ChangeTracker.create(mockSchema);

//         expect(tracker).toBeInstanceOf(ChangeTracker);
//         expect(tracker.hasChanges()).toBe(false);
//     });

//     it('should delegate add to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const entities = [{ id: '1', name: 'test' }];
//         const tag = 'test-tag';
//         const done = vi.fn();

//         tracker.add(entities, tag, done);

//         expect(mockStrategy.add).toHaveBeenCalledWith(entities, tag, done);
//     });

//     it('should delegate remove to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const entities = [{ id: '1', name: 'test' }];
//         const tag = 'test-tag';
//         const done = vi.fn();

//         tracker.remove(entities, tag, done);

//         expect(mockStrategy.remove).toHaveBeenCalledWith(entities, tag, done);
//     });

//     it('should delegate removeByQuery to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const query = { test: 'query' };
//         const tag = 'test-tag';
//         const done = vi.fn();

//         tracker.removeByQuery(query as any, tag, done);

//         expect(mockStrategy.removeByQuery).toHaveBeenCalledWith(query, tag, done);
//     });

//     it('should delegate resolve to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const entities = [{ id: '1', name: 'test' }];
//         const tag = 'test-tag';
//         const options = { merge: true };

//         tracker.resolve(entities, tag, options);

//         expect(mockStrategy.resolve).toHaveBeenCalledWith(entities, tag, options);
//     });

//     it('should delegate hasChanges to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         mockStrategy.hasChanges.mockReturnValue(true);

//         const result = tracker.hasChanges();

//         expect(mockStrategy.hasChanges).toHaveBeenCalled();
//         expect(result).toBe(true);
//     });

//     it('should delegate replace to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const existingEntity = { id: '1', name: 'original' };
//         const newEntity = { id: '1', name: 'updated' };

//         tracker.replace(existingEntity, newEntity);

//         expect(mockStrategy.replace).toHaveBeenCalledWith(existingEntity, newEntity);
//     });

//     it('should delegate enrich to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const entities = [{ id: '1', name: 'test' }];
//         mockStrategy.enrich.mockReturnValue(entities);

//         const result = tracker.enrich(entities);

//         expect(mockStrategy.enrich).toHaveBeenCalledWith(entities);
//         expect(result).toBe(entities);
//     });

//     it('should delegate prepareRemovals to strategy when hasChanges is true', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         mockStrategy.hasChanges.mockReturnValue(true);
//         const mockRemovals = { entities: [], queries: [] };
//         mockStrategy.prepareRemovals.mockReturnValue(mockRemovals);

//         const result = tracker.prepareRemovals();

//         expect(mockStrategy.prepareRemovals).toHaveBeenCalled();
//         expect(result).toBe(mockRemovals);
//     });

//     it('should return empty removals when hasChanges is false', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         mockStrategy.hasChanges.mockReturnValue(false);

//         const result = tracker.prepareRemovals();

//         expect(mockStrategy.prepareRemovals).not.toHaveBeenCalled();
//         expect(result).toEqual({
//             entities: [],
//             queries: []
//         });
//     });

//     it('should delegate prepareAdditions to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const mockAdditions = { adds: [], find: vi.fn() };
//         mockStrategy.prepareAdditions.mockReturnValue(mockAdditions);

//         const result = tracker.prepareAdditions();

//         expect(mockStrategy.prepareAdditions).toHaveBeenCalled();
//         expect(result).toBe(mockAdditions);
//     });

//     it('should delegate getAttachmentsChanges to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const mockChanges = { updates: [] };
//         mockStrategy.getAttachmentsChanges.mockReturnValue(mockChanges);

//         const result = tracker.getAttachmentsChanges();

//         expect(mockStrategy.getAttachmentsChanges).toHaveBeenCalled();
//         expect(result).toBe(mockChanges);
//     });

//     it('should delegate mergeChanges to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const changes = { adds: [], updates: [], removedCount: 0 };
//         const addPackage = { adds: [], find: vi.fn() };

//         tracker.mergeChanges(changes as any, addPackage);

//         expect(mockStrategy.mergeChanges).toHaveBeenCalledWith(changes, addPackage);
//     });

//     it('should delegate clearAdditions to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);

//         tracker.clearAdditions();

//         expect(mockStrategy.clearAdditions).toHaveBeenCalled();
//     });

//     it('should delegate instance to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const entities = [{ id: '1', name: 'test' }];
//         const changeTrackingType = 'entity';

//         tracker.instance(entities, changeTrackingType);

//         expect(mockStrategy.instance).toHaveBeenCalledWith(entities, changeTrackingType);
//     });

//     it('should delegate detach to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const entities = [{ id: '1', name: 'test' }];

//         tracker.detach(entities);

//         expect(mockStrategy.detach).toHaveBeenCalledWith(entities);
//     });

//     it('should delegate markDirty to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const entities = [{ id: '1', name: 'test' }];

//         tracker.markDirty(entities);

//         expect(mockStrategy.markDirty).toHaveBeenCalledWith(entities);
//     });

//     it('should delegate isAttached to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const entity = { id: '1', name: 'test' };
//         mockStrategy.isAttached.mockReturnValue(true);

//         const result = tracker.isAttached(entity);

//         expect(mockStrategy.isAttached).toHaveBeenCalledWith(entity);
//         expect(result).toBe(true);
//     });

//     it('should delegate filterAttached to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const selector = (entity: any) => entity.id === '1';
//         const filteredEntities = [{ id: '1', name: 'test' }];
//         mockStrategy.filterAttached.mockReturnValue(filteredEntities);

//         const result = tracker.filterAttached(selector);

//         expect(mockStrategy.filterAttached).toHaveBeenCalledWith(selector);
//         expect(result).toBe(filteredEntities);
//     });

//     it('should delegate getAttached to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const entity = { id: '1', name: 'test' };
//         const attachedEntity = { doc: entity, changeType: 'notModified' };
//         mockStrategy.getAttached.mockReturnValue(attachedEntity);

//         const result = tracker.getAttached(entity);

//         expect(mockStrategy.getAttached).toHaveBeenCalledWith(entity);
//         expect(result).toBe(attachedEntity);
//     });

//     it('should delegate getAndDestroyTags to strategy', () => {
//         const tracker = new ChangeTracker(mockStrategy);
//         const tags = { tag1: 'value1' };
//         mockStrategy.getAndDestroyTags.mockReturnValue(tags);

//         const result = tracker.getAndDestroyTags();

//         expect(mockStrategy.getAndDestroyTags).toHaveBeenCalled();
//         expect(result).toBe(tags);
//     });
// }); 