import { describeVectorSearch } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { DexiePlugin } from '../DexiePlugin';

describeVectorSearch('dexie', () => new DexiePlugin(`vector-${uuidv4()}-db`));
