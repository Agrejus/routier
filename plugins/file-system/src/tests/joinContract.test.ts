import { describeJoinContract } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { FileSystemPlugin } from '../FileSystemPlugin';

describeJoinContract('file-system', () => new FileSystemPlugin(`${__dirname}/../dbs`, `join-${uuidv4()}-db`));
