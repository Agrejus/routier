import { describeQueryOracle } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';

describeQueryOracle('memory', () => new MemoryPlugin(`oracle-${uuidv4()}`));
