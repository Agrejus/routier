import { describeVectorSearch } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';

describeVectorSearch('memory', () => new MemoryPlugin(`vector-${uuidv4()}`));
