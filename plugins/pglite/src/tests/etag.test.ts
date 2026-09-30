import { afterAll } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uuidv4 } from '@routier/core';
import { describeEtagContract } from '@routier/test-utils';
import { PGliteDbPlugin } from '../index';
import { whenPGliteCanRun } from './vmModules';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-pglite-etag-'));

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

whenPGliteCanRun('etag: pglite', () => describeEtagContract('pglite', () => new PGliteDbPlugin(path.join(root, uuidv4()))));
