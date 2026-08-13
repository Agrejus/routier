import { describeJoinContract } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { SqliteDbPlugin } from '../index';

/**
 * The same suite the in-memory backends run, against a real engine that pairs the rows itself.
 * Identical expectations is the whole point: which interpretation ran is meant to be invisible.
 */
describeJoinContract('sqlite', () => new SqliteDbPlugin(`join-${uuidv4()}.sqlite`));
