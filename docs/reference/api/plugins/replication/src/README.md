[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / plugins/replication/src

# plugins/replication/src

## Classes

- [HttpDbPlugin](classes/HttpDbPlugin.md)
- [HttpSwrDbPlugin](classes/HttpSwrDbPlugin.md)
- [HttpTransportDbPlugin](classes/HttpTransportDbPlugin.md)
- [OptimisticUpdatesDbPlugin](classes/OptimisticUpdatesDbPlugin.md)
- [PluginSyncEngine](classes/PluginSyncEngine.md)
- [HttpStatusError](classes/HttpStatusError.md)
- [NetworkError](classes/NetworkError.md)

## Interfaces

- [HttpConnectionOptions](interfaces/HttpConnectionOptions.md)
- [HttpPluginOptions](interfaces/HttpPluginOptions.md)
- [AutoSyncOptions](interfaces/AutoSyncOptions.md)
- [HttpSwrDbPluginOptions](interfaces/HttpSwrDbPluginOptions.md)
- [QuerySerializationContext](interfaces/QuerySerializationContext.md)
- [SyncHooks](interfaces/SyncHooks.md)

## Type Aliases

- [SyncOutcome](type-aliases/SyncOutcome.md)
- [HttpTransportDbPluginOptions](type-aliases/HttpTransportDbPluginOptions.md)
- [OptimisticUpdatesDbPluginOptions](type-aliases/OptimisticUpdatesDbPluginOptions.md)
- [MirrorErrorContext](type-aliases/MirrorErrorContext.md)
- [QueryFailureMode](type-aliases/QueryFailureMode.md)
- [MirrorFailureMode](type-aliases/MirrorFailureMode.md)
- [PersistAckMode](type-aliases/PersistAckMode.md)
- [DestroyFailureMode](type-aliases/DestroyFailureMode.md)
- [MirrorPersistPayloadMode](type-aliases/MirrorPersistPayloadMode.md)
- [PluginSyncEngineOptions](type-aliases/PluginSyncEngineOptions.md)
- [QueuedChangeKind](type-aliases/QueuedChangeKind.md)
- [UnsyncedQueueRow](type-aliases/UnsyncedQueueRow.md)
- [RetryOptions](type-aliases/RetryOptions.md)
- [RejectedChange](type-aliases/RejectedChange.md)
- [ReadEvent](type-aliases/ReadEvent.md)
- [ChangesRejectedEvent](type-aliases/ChangesRejectedEvent.md)
- [SyncedEvent](type-aliases/SyncedEvent.md)
- [SyncEvent](type-aliases/SyncEvent.md)
- [ResponseHeaders](type-aliases/ResponseHeaders.md)
- [FailureKind](type-aliases/FailureKind.md)
- [FailureDetails](type-aliases/FailureDetails.md)
- [RetryAction](type-aliases/RetryAction.md)
- [DoneAction](type-aliases/DoneAction.md)
- [UseCachedAction](type-aliases/UseCachedAction.md)
- [RejectAction](type-aliases/RejectAction.md)
- [DeferAction](type-aliases/DeferAction.md)
- [HttpRequestError](type-aliases/HttpRequestError.md)
- [SwrRequestError](type-aliases/SwrRequestError.md)
- [OptimisticRequestError](type-aliases/OptimisticRequestError.md)
- [AnyRequestError](type-aliases/AnyRequestError.md)

## Functions

- [isAuthStatus](functions/isAuthStatus.md)
- [isConflictStatus](functions/isConflictStatus.md)
- [isPermanentStatus](functions/isPermanentStatus.md)
- [createRetry](functions/createRetry.md)
- [defaultSync](functions/defaultSync.md)
