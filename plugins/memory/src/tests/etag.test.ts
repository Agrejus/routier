import { uuidv4 } from '@routier/core';
import { describeEtagContract } from '@routier/test-utils';
import { MemoryPlugin } from '../MemoryPlugin';

describeEtagContract('memory', () => new MemoryPlugin(uuidv4()));
