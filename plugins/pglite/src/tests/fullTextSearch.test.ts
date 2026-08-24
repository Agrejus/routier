import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uuidv4 } from '@routier/core';
import { describeFullTextSearch } from '@routier/test-utils';
import { PGliteDbPlugin } from '../index';

/**
 * The feature deliberately does not use an engine's own search — see "Why the engine's own
 * search is out" in specs/full-text-search.md — so PostgreSQL's `tsvector` is not involved.
 * What is being checked is that the index rows and the `IN` that narrows them behave here.
 */

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-pglite-fts-'));

describeFullTextSearch('pglite', () => new PGliteDbPlugin(path.join(root, uuidv4())));
