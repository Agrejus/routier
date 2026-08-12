import { describeJoinContract } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';

describeJoinContract('memory', () => new MemoryPlugin(`join-${uuidv4()}`));
