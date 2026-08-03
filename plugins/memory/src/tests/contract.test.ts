import { describePluginContract } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';

describePluginContract('memory', () => new MemoryPlugin(`contract-${uuidv4()}`), { supportsRichTypes: true });
