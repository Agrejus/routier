import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { uuidv4 } from '@routier/core';
import { FileSystemPlugin } from '../FileSystemPlugin';

/**
 * destroy() removes a database recursively, because a database is a directory of
 * per-collection JSON files. These tests pin the blast radius of that delete.
 *
 * The recursion is necessary — the previous non-recursive unlink could never succeed on a
 * directory, so destroy silently never worked — but it also means a bad path is now
 * genuinely destructive rather than merely failing. Everything below exists to keep that
 * from regressing.
 */

const destroyEvent = () => ({ id: uuidv4(), schemas: undefined, source: 'test', action: 'destroy' }) as any;

const destroy = (plugin: FileSystemPlugin) =>
    new Promise<any>(resolve => plugin.destroy(destroyEvent(), resolve as any));

const tempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'routier-destroy-'));

describe('FileSystemPlugin.destroy blast radius', () => {
    it('removes only its own database directory', async () => {
        const root = tempRoot();
        const mine = `db-${uuidv4()}`;
        const sibling = `db-${uuidv4()}`;

        fs.mkdirSync(path.join(root, mine), { recursive: true });
        fs.writeFileSync(path.join(root, mine, 'products.json'), '[]');
        fs.mkdirSync(path.join(root, sibling), { recursive: true });
        fs.writeFileSync(path.join(root, sibling, 'products.json'), '[]');

        const result = await destroy(new FileSystemPlugin(root, mine));

        expect(result.ok).toBe('success');
        expect(fs.existsSync(path.join(root, mine))).toBe(false);
        // The sibling database must be untouched: destroy is scoped to one database.
        expect(fs.existsSync(path.join(root, sibling, 'products.json'))).toBe(true);
        expect(fs.existsSync(root)).toBe(true);
    });

    it('succeeds when the database was never written', async () => {
        const root = tempRoot();

        const result = await destroy(new FileSystemPlugin(root, `db-${uuidv4()}`));

        expect(result.ok).toBe('success');
        expect(fs.existsSync(root)).toBe(true);
    });

    it('refuses to destroy when the database name is empty', async () => {
        const root = tempRoot();
        fs.writeFileSync(path.join(root, 'bystander.json'), '[]');

        // An empty name collapses under path.join, so the target becomes the configured
        // directory itself — a recursive delete there would take every database with it.
        const result = await destroy(new FileSystemPlugin(root, ''));

        expect(result.ok).toBe('error');
        expect(fs.existsSync(path.join(root, 'bystander.json'))).toBe(true);
    });

    it('refuses to destroy when the database name is a dot', async () => {
        const root = tempRoot();
        fs.writeFileSync(path.join(root, 'bystander.json'), '[]');

        const result = await destroy(new FileSystemPlugin(root, '.'));

        expect(result.ok).toBe('error');
        expect(fs.existsSync(path.join(root, 'bystander.json'))).toBe(true);
    });

    it('refuses to destroy a path that escapes the configured directory', async () => {
        const root = tempRoot();
        const outside = path.join(root, 'outside.json');
        fs.writeFileSync(outside, '[]');
        const nested = path.join(root, 'nested');
        fs.mkdirSync(nested, { recursive: true });

        // `..` walks out of the configured directory entirely.
        const result = await destroy(new FileSystemPlugin(nested, '..'));

        expect(result.ok).toBe('error');
        expect(fs.existsSync(outside)).toBe(true);
    });

    it('refuses a nested database name rather than reaching into a subdirectory', async () => {
        const root = tempRoot();
        fs.mkdirSync(path.join(root, 'a', 'b'), { recursive: true });
        fs.writeFileSync(path.join(root, 'a', 'keep.json'), '[]');

        // Only direct children are destroyable; anything deeper is refused so the rule stays
        // simple enough to reason about at a call site.
        const result = await destroy(new FileSystemPlugin(root, path.join('a', 'b')));

        expect(result.ok).toBe('error');
        expect(fs.existsSync(path.join(root, 'a', 'keep.json'))).toBe(true);
    });
});
