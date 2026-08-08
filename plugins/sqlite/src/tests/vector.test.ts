import { describeVectorSearch } from '@routier/test-utils';
import { uuidv4 } from '@routier/core';
import { SqliteDbPlugin } from '../index';

/**
 * SQLite has no vector type, so `s.vector()` becomes a JSON column and `.nearest()` is
 * scored in memory by `SqlTranslator`. This is the path every SQL engine without native
 * support takes, and the reason `supportsRichTypes` is irrelevant here: a vector needs no
 * per-property serializer from the caller, unlike the arrays in the rich contract shape.
 */
describeVectorSearch('sqlite', () => new SqliteDbPlugin(`vector-${uuidv4()}.sqlite`));
