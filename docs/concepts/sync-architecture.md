# CDC-Based Synchronization Architecture

## Overview

This document outlines the implementation sketch for a Change Data Capture (CDC) based synchronization system for `SyncDataStore`. The architecture uses server-provided timestamps to eliminate clock drift and ensures atomic operations between data and metadata updates.

## Key Principles

1. **Server Timestamp Authority**: All timestamps are server-generated. Clients never create timestamps for sync purposes.
2. **Atomic Operations**: CDC metadata updates and data changes must be atomic. If one fails, both roll back.
3. **Incremental Sync**: Only fetch changes since last known server timestamp.
4. **Offline Support**: Queue local changes when offline, sync when online.

## Architecture Components

### Client-Side Infrastructure

#### CDC Table (Change Data Capture Metadata)

Stores the last known server timestamp for each schema/collection.

```typescript
interface SyncMetadata {
  schemaId: string;              // Collection identifier
  lastSyncTimestamp: number;     // Server-provided timestamp from last successful sync
}
```

**Storage Strategy**: Store in the same database as data to enable atomic transactions.

#### QUEUE Table (Pending Local Changes)

Tracks local changes that haven't been sent to the server yet.

```typescript
interface PendingChange {
  schemaId: string;
  entityId: string;              // Hash of entity IDs
  changeType: 'add' | 'update' | 'remove';
  localTimestamp: number;        // When change was made locally (for ordering only)
  serverTimestamp?: number;      // Server-provided timestamp after successful sync
  entityData?: any;              // Full entity data for adds/updates
  retryCount?: number;           // Number of retry attempts
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}
```

### Server-Side Infrastructure

#### Change Capture Database

Key-value store tracking the latest change timestamp per table.

```typescript
interface TableChangeTimestamp {
  tableName: string;
  lastChangeTimestamp: number;   // Server-generated timestamp (monotonic)
}
```

**Implementation**: Can be a simple key-value store (Redis, in-memory Map, etc.)

#### Primary Database

Standard database with tables. Each entity should have:
- `updated_at` or `modified_at` timestamp (server-generated)
- Index on timestamp column for efficient querying

## API Specifications

### GET /api/sync/timestamps

Returns current server timestamps for all tables.

**Request:**
```
GET /api/sync/timestamps
```

**Response:**
```json
{
  "users": 1234567890,
  "products": 1234567891,
  "orders": 1234567892
}
```

### GET /api/sync/changes

Fetches changes since a given timestamp.

**Request:**
```
GET /api/sync/changes?table=users&since=1234567890&limit=1000
```

**Query Parameters:**
- `table`: Table/collection name
- `since`: Client's last known server timestamp
- `limit`: Maximum number of records to return (optional, default: 1000)

**Response:**
```json
{
  "data": [
    {
      "id": "123",
      "name": "Updated Name",
      "updated_at": 1234567891
    }
  ],
  "serverTimestamp": 1234567892,
  "hasMore": false
}
```

**Response Fields:**
- `data`: Array of changed entities (empty if no changes)
- `serverTimestamp`: Current server timestamp (client MUST save this)
- `hasMore`: Whether more records exist (for pagination)

**Error Handling:**
- If `serverTimestamp === 0` or error response: Fetch failed
- If `data.length === 0` and `serverTimestamp > 0`: No data exists, but sync succeeded

### POST /api/sync/changes

Sends local changes to server.

**Request:**
```json
{
  "table": "users",
  "changes": [
    {
      "type": "add",
      "entity": {
        "id": "123",
        "name": "New User"
      },
      "localTimestamp": 1234567890
    },
    {
      "type": "update",
      "entityId": "456",
      "entity": {
        "id": "456",
        "name": "Updated Name"
      },
      "localTimestamp": 1234567891
    },
    {
      "type": "remove",
      "entityId": "789",
      "localTimestamp": 1234567892
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "serverTimestamp": 1234567893,
  "processedChanges": [
    {
      "entityId": "123",
      "serverTimestamp": 1234567893,
      "status": "success"
    },
    {
      "entityId": "456",
      "serverTimestamp": 1234567893,
      "status": "success"
    },
    {
      "entityId": "789",
      "serverTimestamp": 1234567893,
      "status": "success"
    }
  ],
  "conflicts": []
}
```

**Response Fields:**
- `serverTimestamp`: Server timestamp for this batch (client saves to CDC)
- `processedChanges`: Per-entity server timestamps
- `conflicts`: Array of conflicts that need resolution

## Enhanced SyncDataStore Implementation

### New Methods

```typescript
export abstract class SyncDataStore extends DataStore {
  
  // Get sync metadata for a schema
  protected getSyncMetadata(schemaId: string): SyncMetadata | null {
    // Retrieve from CDC table/collection
  }
  
  // Update sync metadata with server-provided timestamp
  protected updateSyncMetadata(
    schemaId: string, 
    serverTimestamp: number,
    done: CallbackResult<void>
  ): void {
    // Update CDC table atomically
  }
  
  // Enhanced fetch with timestamp support
  abstract fetchRemoteData<T extends {}>(
    schema: CompiledSchema<T>,
    sinceTimestamp: number | null,  // Client's last known server timestamp
    done: CallbackResult<{ data: T[], serverTimestamp: number }>
  ): void;
  
  // Queue local change for later sync
  protected queueLocalChange(
    schemaId: string,
    change: PendingChange
  ): void {
    // Add to QUEUE table
  }
  
  // Process queued changes
  protected processQueuedChanges(
    schemaId: string,
    done: CallbackResult<void>
  ): void {
    // Send QUEUE items to server
    // Update CDC with server timestamp on success
    // Remove from QUEUE on success
  }
  
  // Atomic sync operation
  private atomicSyncRemoteData<T>(
    schema: CompiledSchema<T>,
    remoteData: T[],
    serverTimestamp: number,
    done: CallbackResult<void>
  ): void {
    // 1. Calculate changes
    // 2. Apply data changes
    // 3. Update CDC metadata
    // 4. Commit atomically (or rollback both on failure)
  }
}
```

### Atomic Operations Strategy

#### Option A: Plugin Transaction Support (Preferred)

If the plugin supports transactions:

```typescript
// In IDbPlugin interface
interface IDbPlugin {
  // ... existing methods ...
  
  beginTransaction?(): string | Promise<string>;
  commitTransaction?(txId: string, done: CallbackResult<void>): void;
  rollbackTransaction?(txId: string, done: CallbackResult<void>): void;
  
  // OR: Atomic bulk operation
  atomicBulkPersistWithMetadata?(
    event: DbPluginBulkPersistEvent & { 
      metadata?: Map<string, SyncMetadata> 
    },
    done: PluginEventCallbackPartialResult<BulkPersistResult>
  ): void;
}
```

**Implementation Flow:**
1. Begin transaction
2. Apply data changes
3. Update CDC metadata
4. Commit transaction (both succeed or both fail)

#### Option B: Store CDC in Same Collection

Store CDC metadata as special entities in a metadata collection:

```typescript
class SyncDataStore {
  private metadataSchema: CompiledSchema<SyncMetadata>;
  private metadataCollection: Collection<SyncMetadata>;
  
  constructor(plugin: IDbPlugin) {
    super(plugin);
    
    // Create metadata schema
    this.metadataSchema = s.define("__sync_metadata__", {
      schemaId: s.string().key(),
      lastSyncTimestamp: s.number()
    }).compile();
    
    this.metadataCollection = this.collection(this.metadataSchema).create();
  }
  
  private atomicSyncWithMetadata<T>(
    schema: CompiledSchema<T>,
    remoteData: T[],
    serverTimestamp: number,
    done: CallbackResult<void>
  ): void {
    const collection = this.collections.get(schema.id);
    const { adds, updates, removals } = this.calculateChanges(schema, remoteData);
    
    // Create bulk changes including both data AND metadata
    const bulkChanges = new BulkPersistChanges();
    
    // Data changes
    const schemaChanges = bulkChanges.resolve(schema.id);
    schemaChanges.adds = adds;
    schemaChanges.updates = updates.map(u => u.remote);
    schemaChanges.removes = removals;
    
    // Metadata update
    const metadataChanges = bulkChanges.resolve(this.metadataSchema.id);
    const existingMetadata = this.getSyncMetadata(schema.id);
    if (existingMetadata) {
      metadataChanges.updates = [{
        schemaId: schema.id,
        lastSyncTimestamp: serverTimestamp
      }];
    } else {
      metadataChanges.adds = [{
        schemaId: schema.id,
        lastSyncTimestamp: serverTimestamp
      }];
    }
    
    // Single atomic operation via saveChanges
    this.saveChanges((result) => {
      if (result.ok === Result.ERROR) {
        // Everything rolled back automatically
        return done(result);
      }
      
      // Both data and metadata updated atomically
      done(Result.success());
    });
  }
}
```

#### Option C: Compensating Transaction Pattern

If transactions aren't available, use compensating transactions:

```typescript
private atomicSyncWithCompensation<T>(
  schema: CompiledSchema<T>,
  remoteData: T[],
  serverTimestamp: number,
  done: CallbackResult<void>
): void {
  const collection = this.collections.get(schema.id);
  const { adds, updates, removals } = this.calculateChanges(schema, remoteData);
  
  // Store original state for rollback
  const originalState = this.snapshotCollection(collection);
  
  // Step 1: Apply data changes
  this.applyChanges(collection, adds, updates, removals, (changeResult) => {
    if (changeResult.ok === Result.ERROR) {
      return done(changeResult);
    }
    
    // Step 2: Update CDC metadata
    this.updateSyncMetadata(schema.id, serverTimestamp, (metadataResult) => {
      if (metadataResult.ok === Result.ERROR) {
        // CDC update failed - rollback data changes
        this.rollbackChanges(collection, originalState, () => {
          done(Result.error("Failed to update CDC metadata"));
        });
        return;
      }
      
      // Both succeeded
      done(Result.success());
    });
  });
}
```

## Sync Flow Diagrams

### Incremental Sync Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ 1. Get local CDC timestamp
     │    lastSyncTimestamp = 1234567890
     │
     ▼
┌─────────────────────────────────┐
│ GET /api/sync/timestamps        │
└────┬────────────────────────────┘
     │
     │ 2. Server returns current timestamps
     │    { users: 1234567892 }
     │
     ▼
┌─────────────────────────────────┐
│ Compare: 1234567892 > 1234567890│
│ → Need to sync                   │
└────┬────────────────────────────┘
     │
     │ 3. Request changes since last sync
     │
     ▼
┌──────────────────────────────────────────────┐
│ GET /api/sync/changes?table=users&since=...  │
└────┬─────────────────────────────────────────┘
     │
     │ 4. Server returns changes + timestamp
     │    { data: [...], serverTimestamp: 1234567892 }
     │
     ▼
┌──────────────────────────────────────────────┐
│ Atomic Operation:                            │
│  a. Apply data changes                       │
│  b. Update CDC with serverTimestamp         │
│  c. Commit (both succeed or both fail)      │
└────┬─────────────────────────────────────────┘
     │
     │ 5. Sync complete
     │
     ▼
┌─────────┐
│ Success │
└─────────┘
```

### Initial Sync Flow (No Data)

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ 1. Check CDC: No entry or timestamp = 0
     │
     ▼
┌──────────────────────────────────────────────┐
│ GET /api/sync/changes?table=users&since=0    │
└────┬─────────────────────────────────────────┘
     │
     │ 2. Server response
     │    { data: [...], serverTimestamp: 1234567890 }
     │    OR
     │    { data: [], serverTimestamp: 1234567890 }
     │
     ▼
┌──────────────────────────────────────────────┐
│ If data.length === 0 && serverTimestamp > 0: │
│ → Server has no data (not an error)          │
│ → Update CDC with serverTimestamp            │
└────┬─────────────────────────────────────────┘
     │
     │ 3. If data.length > 0:
     │    Atomic operation: save data + update CDC
     │
     ▼
┌─────────┐
│ Success │
└─────────┘
```

### QUEUE Processing Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ 1. Get pending changes from QUEUE
     │    status = 'pending'
     │
     ▼
┌──────────────────────────────────────────────┐
│ POST /api/sync/changes                        │
│ Body: { table: "users", changes: [...] }     │
└────┬─────────────────────────────────────────┘
     │
     │ 2. Server processes changes
     │    Returns: { serverTimestamp: 1234567893 }
     │
     ▼
┌──────────────────────────────────────────────┐
│ Atomic Operation:                            │
│  a. Remove from QUEUE (or mark as 'synced')  │
│  b. Update CDC with serverTimestamp          │
│  c. Commit                                    │
└────┬─────────────────────────────────────────┘
     │
     │ 3. If CDC update fails:
     │    → Keep in QUEUE (will retry)
     │    → Don't update CDC
     │
     │ 4. If both succeed:
     │    → QUEUE cleaned up
     │    → CDC updated
     │
     ▼
┌─────────┐
│ Success │
└─────────┘
```

## Implementation Phases

### Phase 1: CDC Metadata Storage
- [ ] Create metadata schema
- [ ] Implement `getSyncMetadata()` and `updateSyncMetadata()`
- [ ] Store metadata in same database as data

### Phase 2: Enhanced fetchRemoteData
- [ ] Add `sinceTimestamp` parameter
- [ ] Update API to return `{ data, serverTimestamp }`
- [ ] Client saves `serverTimestamp` to CDC

### Phase 3: QUEUE Implementation
- [ ] Create QUEUE table/collection
- [ ] Implement `queueLocalChange()`
- [ ] Queue changes in `saveChanges()`

### Phase 4: Atomic Operations
- [ ] Implement atomic sync operation
- [ ] Ensure CDC and data update together
- [ ] Add rollback/compensation logic

### Phase 5: QUEUE Processing
- [ ] Implement `processQueuedChanges()`
- [ ] Send QUEUE items to server
- [ ] Update CDC and clear QUEUE atomically

### Phase 6: Server API
- [ ] Implement `/api/sync/timestamps`
- [ ] Implement `/api/sync/changes` (GET)
- [ ] Implement `/api/sync/changes` (POST)
- [ ] Add timestamp tracking on server

### Phase 7: Conflict Resolution
- [ ] Detect conflicts
- [ ] Implement resolution strategies
- [ ] Handle merge conflicts

### Phase 8: Error Handling & Retries
- [ ] Retry logic for failed QUEUE items
- [ ] Exponential backoff
- [ ] Max retry limits
- [ ] Error logging

## Critical Rules

1. **Never update CDC without updating data** - Both must succeed or both must fail
2. **Never update data without updating CDC** - Prevents re-syncing same data
3. **Always use server timestamps** - Client never generates sync timestamps
4. **Atomic operations only** - Use transactions or compensating transactions
5. **Idempotent operations** - Operations should be safe to retry
6. **Log everything** - All sync operations should be logged for debugging

## Error Scenarios

### Scenario 1: Data Update Succeeds, CDC Update Fails
**Solution**: Rollback data changes using compensating transaction

### Scenario 2: Network Failure During Sync
**Solution**: CDC not updated, will retry on next sync (won't re-fetch same data)

### Scenario 3: Server Returns Empty Data
**Solution**: Update CDC with `serverTimestamp` anyway (indicates "no data" state)

### Scenario 4: Clock Drift
**Solution**: Not applicable - all timestamps are server-provided

### Scenario 5: Concurrent Syncs
**Solution**: Use locking or ensure operations are idempotent

## Testing Considerations

1. **Test atomicity**: Verify CDC and data update together
2. **Test rollback**: Verify both rollback on failure
3. **Test initial sync**: Verify behavior with no existing data
4. **Test incremental sync**: Verify only new changes are fetched
5. **Test QUEUE**: Verify offline changes are queued and synced
6. **Test conflicts**: Verify conflict resolution works
7. **Test network failures**: Verify retry logic
8. **Test large datasets**: Verify pagination and batching

## Performance Considerations

1. **Batch operations**: Process changes in batches (100-1000 records)
2. **Index timestamps**: Ensure `updated_at` columns are indexed
3. **Pagination**: Use `limit` and `hasMore` for large result sets
4. **Parallel syncs**: Sync multiple collections in parallel
5. **Debounce QUEUE**: Don't send every change immediately, batch them

## Security Considerations

1. **Authentication**: All API endpoints must be authenticated
2. **Authorization**: Verify user has access to requested tables
3. **Rate limiting**: Prevent abuse of sync endpoints
4. **Data validation**: Validate all incoming changes
5. **Audit logging**: Log all sync operations for security auditing
