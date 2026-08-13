[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / SYNC\_CONSTANTS

# Variable: SYNC\_CONSTANTS

> `const` **SYNC\_CONSTANTS**: `object`

Defined in: [datastore/src/utils/constants.ts:4](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/utils/constants.ts#L4)

Constants used throughout the sync system

## Type Declaration

### SYNC\_MARKER

> `readonly` **SYNC\_MARKER**: `"__sync__"` = `'__sync__'`

Special marker for sync events in recordIds
Used to track when we successfully fetched from the server

### ENDPOINTS

> `readonly` **ENDPOINTS**: `object`

API endpoint paths for sync server

#### ENDPOINTS.TIMESTAMPS

> `readonly` **TIMESTAMPS**: `"/api/sync/timestamps"` = `'/api/sync/timestamps'`

GET endpoint to fetch current server timestamps for all tables

#### ENDPOINTS.CHANGES

> `readonly` **CHANGES**: `"/api/sync/changes"` = `'/api/sync/changes'`

GET endpoint to fetch changes since a given timestamp

#### ENDPOINTS.POST\_CHANGES

> `readonly` **POST\_CHANGES**: `"/api/sync/changes"` = `'/api/sync/changes'`

POST endpoint to send local changes to the server

#### ENDPOINTS.CHANGES\_STREAM

> `readonly` **CHANGES\_STREAM**: `"/api/sync/changes/stream"` = `'/api/sync/changes/stream'`

GET endpoint for Server-Sent Events (SSE) real-time change streaming

#### ENDPOINTS.HEALTH

> `readonly` **HEALTH**: `"/health"` = `'/health'`

GET endpoint for health check

### QUERY\_PARAMS

> `readonly` **QUERY\_PARAMS**: `object`

Query parameter names for API endpoints

#### QUERY\_PARAMS.TABLE

> `readonly` **TABLE**: `"table"` = `'table'`

#### QUERY\_PARAMS.SINCE

> `readonly` **SINCE**: `"since"` = `'since'`

#### QUERY\_PARAMS.LIMIT

> `readonly` **LIMIT**: `"limit"` = `'limit'`

#### QUERY\_PARAMS.CLIENT\_ID

> `readonly` **CLIENT\_ID**: `"clientId"` = `'clientId'`

### ~~SSE\_ENDPOINT~~

> `readonly` **SSE\_ENDPOINT**: `"/api/sync/changes/stream"` = `'/api/sync/changes/stream'`

SSE endpoint path (kept for backward compatibility)

#### Deprecated

Use ENDPOINTS.CHANGES_STREAM instead

### ~~SSE\_PARAMS~~

> `readonly` **SSE\_PARAMS**: `object`

Query parameter names for SSE (kept for backward compatibility)

#### Deprecated

Use QUERY_PARAMS instead

#### SSE\_PARAMS.TABLE

> `readonly` **TABLE**: `"table"` = `'table'`

#### SSE\_PARAMS.SINCE

> `readonly` **SINCE**: `"since"` = `'since'`

#### SSE\_PARAMS.CLIENT\_ID

> `readonly` **CLIENT\_ID**: `"clientId"` = `'clientId'`
