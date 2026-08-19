[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / RetryDbPluginOptions

# Type Alias: RetryDbPluginOptions

> **RetryDbPluginOptions** = `object`

Defined in: [core/src/plugins/RetryDbPlugin.ts:32](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/RetryDbPlugin.ts#L32)

Retries a failed READ, and never a write.

## Why reads only

A read is idempotent by construction: running the same query twice asks the same question
and changes nothing, so a second attempt is free apart from latency. That is what makes a
blanket retry safe here, and it is why this wrapper does not need to know which errors are
transient — see `shouldRetry`.

A save is not. `bulkPersist` is a batch of adds, updates and removes, and a failure gives no
general way to know how much of it landed: a backend without atomic batches may have applied
part of it, and a retry then re-applies what already succeeded. Adds are the sharpest case —
an identity is assigned by the database, so a repeated INSERT does not collide, it
DUPLICATES. Rows appear that no caller asked for, no error is reported, and the change
tracker records a successful save.

Retrying a write safely would need the write to carry an idempotency key the backend
deduplicates on, which is a property of a backend rather than something a wrapper can add.
So this refuses to guess, and a failed save is surfaced for the caller to decide about.

```ts
const store = new MyStore(new RetryDbPlugin(new SomeDbPlugin(...), { attempts: 3 }));
```

## Properties

### attempts?

> `optional` **attempts**: `number`

Defined in: [core/src/plugins/RetryDbPlugin.ts:39](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/RetryDbPlugin.ts#L39)

Total attempts, including the first. Default 3, minimum 1.

"Attempts" rather than "retries" because off-by-one here is a real cost — the difference
between three calls and four against a struggling backend.

***

### delayMs()?

> `optional` **delayMs**: (`attempt`) => `number`

Defined in: [core/src/plugins/RetryDbPlugin.ts:48](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/RetryDbPlugin.ts#L48)

Milliseconds to wait before attempt `attempt` (2 for the first retry).

Default is exponential — 50ms, 100ms, 200ms — with no jitter. Jitter matters when many
clients retry in lockstep after a shared outage, and a caller with that problem knows it
and can supply a delay; adding randomness by default would make tests non-deterministic
for everyone else.

#### Parameters

##### attempt

`number`

#### Returns

`number`

***

### shouldRetry()?

> `optional` **shouldRetry**: (`error`, `attempt`) => `boolean`

Defined in: [core/src/plugins/RetryDbPlugin.ts:60](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/RetryDbPlugin.ts#L60)

Whether an error is worth another attempt. Default: every error is.

That default is deliberate and only defensible because this retries reads alone. A
wrapper cannot know which of a backend's errors are transient without naming that
backend, and guessing wrong in the cautious direction means not retrying the failure the
caller installed this for. Retrying a permanent error instead costs a bounded amount of
latency and nothing else.

Supply this to narrow it — a syntax error in a filter will never succeed on a second try.

#### Parameters

##### error

`unknown`

##### attempt

`number`

#### Returns

`boolean`
