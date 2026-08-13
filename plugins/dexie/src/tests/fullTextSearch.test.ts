import { describeFullTextSearch } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { DexiePlugin } from '../DexiePlugin';

describeFullTextSearch('dexie', () => new DexiePlugin(`fts-${uuidv4()}-db`));
