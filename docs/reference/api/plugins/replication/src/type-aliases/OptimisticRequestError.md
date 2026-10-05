[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / OptimisticRequestError

# Type Alias: OptimisticRequestError

> **OptimisticRequestError** = [`FailureDetails`](FailureDetails.md)\<`"read"`\> & [`RetryAction`](RetryAction.md) & [`DoneAction`](DoneAction.md) & [`UseCachedAction`](UseCachedAction.md) \| [`FailureDetails`](FailureDetails.md)\<`"write"`\> & [`RetryAction`](RetryAction.md) & [`RejectAction`](RejectAction.md)

Defined in: plugins/replication/src/syncHooks.ts:52
