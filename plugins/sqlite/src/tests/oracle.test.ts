import { describeQueryOracle } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { SqliteDbPlugin } from '../index';

describeQueryOracle('sqlite', () => new SqliteDbPlugin(`oracle-${uuidv4()}.sqlite`));
