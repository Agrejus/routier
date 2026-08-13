import { describeFullTextSearch } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';

describeFullTextSearch('memory', () => new MemoryPlugin(`fts-${uuidv4()}`));
