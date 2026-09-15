import { describePluginContract, RENAMED_CALL_SELECTOR_TESTS } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { DexiePlugin } from '../DexiePlugin';

describePluginContract(
    'dexie',
    () => new DexiePlugin(`contract-${uuidv4()}-db`),
    {
        supportsRichTypes: true,
        knownFailing: RENAMED_CALL_SELECTOR_TESTS,
        reopen: plugin => new DexiePlugin(plugin.databaseName!),
    },
);
