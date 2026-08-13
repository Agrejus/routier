import { describeFullTextSearch } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { FileSystemPlugin } from '../FileSystemPlugin';

describeFullTextSearch(
    'file-system',
    () => new FileSystemPlugin(`${__dirname}/../dbs`, `fts-${uuidv4()}-db`),
);
