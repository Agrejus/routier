import { describeQueryOracle } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { DexiePlugin } from '../DexiePlugin';

describeQueryOracle('dexie', () => new DexiePlugin(`oracle-${uuidv4()}-db`));
