import { describeQueryOracle } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { FileSystemPlugin } from '../FileSystemPlugin';

describeQueryOracle('file-system', () => new FileSystemPlugin(`${__dirname}/../dbs`, `oracle-${uuidv4()}-db`));
