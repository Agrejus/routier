import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uuidv4 } from '@routier/core';
import { describeQueryOracle } from '@routier/test-utils';
import { PGliteDbPlugin } from '../index';
import { whenPGliteCanRun } from './vmModules';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-pglite-oracle-'));

whenPGliteCanRun('query oracle: pglite', () =>
    describeQueryOracle('pglite', () => new PGliteDbPlugin(path.join(root, uuidv4()))));
