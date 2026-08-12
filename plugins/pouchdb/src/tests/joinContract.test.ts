import { describeJoinContract } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { PouchDbPlugin } from '../PouchDbPlugin';

describeJoinContract('pouchdb', () => new PouchDbPlugin(uuidv4()));
