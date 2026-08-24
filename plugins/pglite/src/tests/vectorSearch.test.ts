import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uuidv4 } from '@routier/core';
import { describeVectorSearch } from '@routier/test-utils';
import { vector } from '@electric-sql/pglite-pgvector';
import { PGliteDbPlugin } from '../index';
import { whenPGliteCanRun } from './vmModules';

/**
 * Both vector paths this plugin has: a real `vector` column with pgvector loaded, and the
 * JSONB fallback that scores in memory without it. The hand-written pair in `plugin.test.ts`
 * covered one case each.
 */

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-pglite-vector-'));
const dataDir = () => path.join(root, uuidv4());

whenPGliteCanRun('vector search: pglite', () => {
    describeVectorSearch('pglite (pgvector)', () => new PGliteDbPlugin(dataDir(), { extensions: { vector } }));
    describeVectorSearch('pglite (no pgvector)', () => new PGliteDbPlugin(dataDir()));
});
