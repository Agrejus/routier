import { describeJoinContract } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { DexiePlugin } from '../DexiePlugin';

describeJoinContract('dexie', () => new DexiePlugin(`join-${uuidv4()}-db`));
