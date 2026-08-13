import { describePluginContract } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { DexiePlugin } from '../DexiePlugin';

describePluginContract(
    'dexie',
    () => new DexiePlugin(`contract-${uuidv4()}-db`),
    {
        supportsRichTypes: true,
        knownFailing: [],
    },
);
