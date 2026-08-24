import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uuidv4 } from '@routier/core';
import { describeJoinContract } from '@routier/test-utils';
import { PGliteDbPlugin } from '../index';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-pglite-joins-'));

describeJoinContract('pglite', () => new PGliteDbPlugin(path.join(root, uuidv4())));
