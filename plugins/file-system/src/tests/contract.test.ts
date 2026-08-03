import { describePluginContract } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { FileSystemPlugin } from '../FileSystemPlugin';

describePluginContract(
    'file-system',
    () => new FileSystemPlugin(`${__dirname}/../dbs`, `contract-${uuidv4()}-db`),
    { supportsRichTypes: true },
);
