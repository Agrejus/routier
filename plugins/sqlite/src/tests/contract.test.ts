import { describePluginContract } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { SqliteDbPlugin } from '../index';

describePluginContract(
    'sqlite',
    () => new SqliteDbPlugin(`contract-${uuidv4()}.sqlite`),
    {
        // Rich types are left off deliberately: SQLite has no native boolean, date, array,
        // or object column type, so those shapes need per-property serializers at the schema
        // level rather than support from the plugin.
        supportsRichTypes: false,
        // Dates are not in that list: a date is serialized to TEXT, and a date in an object or array
        // to JSON text, and both read back through the schema.
        supportsDates: true,
        knownFailing: [],
    },
);
