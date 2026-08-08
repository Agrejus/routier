import { CacheDbPlugin, RetryDbPlugin } from '@routier/core/plugins';
import { uuidv4 } from '@routier/core';
import { describePluginContract, describeVectorSearch } from '@routier/test-utils';
import { MemoryPlugin } from '../MemoryPlugin';

/**
 * The read wrappers against the full contract, over a backend that already passes it.
 *
 * A wrapper's own unit tests prove its logic in isolation; they cannot prove it left the
 * contract intact. The cache is the one that could plausibly break it — every query it answers
 * bypasses the backend, so a stale entry, a shared array, or a key that conflates two queries
 * shows up here as a wrong answer to an ordinary question rather than as a cache bug.
 *
 * Retry is included for the cheaper reason: a wrapper that forwards incorrectly fails
 * everything, and that is worth one line to rule out.
 */

describePluginContract(
    'memory behind RetryDbPlugin',
    () => new RetryDbPlugin(new MemoryPlugin(`retry-${uuidv4()}`)),
    { supportsRichTypes: true },
);

describePluginContract(
    'memory behind CacheDbPlugin',
    () => new CacheDbPlugin(new MemoryPlugin(`cache-${uuidv4()}`)),
    { supportsRichTypes: true },
);

describeVectorSearch(
    'memory behind CacheDbPlugin',
    () => new CacheDbPlugin(new MemoryPlugin(`cache-vector-${uuidv4()}`)),
);
