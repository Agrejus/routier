import { describeVectorSearch } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { FileSystemPlugin } from '../FileSystemPlugin';

describeVectorSearch(
    'file-system',
    () => new FileSystemPlugin(`${__dirname}/../dbs`, `vector-${uuidv4()}-db`),
);
