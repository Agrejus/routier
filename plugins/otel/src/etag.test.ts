import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import { describeEtagContract } from '@routier/test-utils';
import { OtelDbPlugin } from './OtelDbPlugin';

describeEtagContract('memory behind OtelDbPlugin', () => new OtelDbPlugin(new MemoryPlugin(`otel-etag-${uuidv4()}`)));
