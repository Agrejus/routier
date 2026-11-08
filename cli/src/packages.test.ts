import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findRoutierPackages, resolvePackage } from './packages';

let root: string;

const install = (folder: string, name: string) => {
    const packageFolder = join(folder, 'node_modules/@routier', name);

    mkdirSync(packageFolder, { recursive: true });
    writeFileSync(join(packageFolder, 'package.json'), JSON.stringify({ name: `@routier/${name}`, main: './main.js' }));
    writeFileSync(join(packageFolder, 'main.js'), '');
};

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'routier-cli-packages-'));
});

afterEach(() => {
    chmodSync(root, 0o755);
    rmSync(root, { recursive: true, force: true });
});

describe('findRoutierPackages', () => {
    it('lists the installed Routier packages in order', async () => {
        install(root, 'fake-sync');
        install(root, 'fake-store');

        expect(await findRoutierPackages(root)).toEqual(['@routier/fake-store', '@routier/fake-sync']);
    });

    it('leaves out the CLI itself', async () => {
        install(root, 'cli');
        install(root, 'fake-core');

        expect(await findRoutierPackages(root)).toEqual(['@routier/fake-core']);
    });

    it('finds packages installed in a parent folder, once each', async () => {
        const app = join(root, 'apps/web');

        mkdirSync(app, { recursive: true });
        install(root, 'fake-core');
        install(root, 'fake-store');
        install(app, 'fake-store');

        expect(await findRoutierPackages(app)).toEqual(['@routier/fake-core', '@routier/fake-store']);
    });

    it('is empty when nothing is installed', async () => {
        expect(await findRoutierPackages(root)).toEqual([]);
    });

    it('ignores files in the scope folder', async () => {
        install(root, 'fake-core');
        writeFileSync(join(root, 'node_modules/@routier/.package-lock.json'), '');

        expect(await findRoutierPackages(root)).toEqual(['@routier/fake-core']);
    });

    it('ignores a scope path that is a file', async () => {
        mkdirSync(join(root, 'node_modules'));
        writeFileSync(join(root, 'node_modules/@routier'), '');

        expect(await findRoutierPackages(root)).toEqual([]);
    });

    it('reports a scope folder it cannot read', async () => {
        install(root, 'fake-core');
        chmodSync(join(root, 'node_modules/@routier'), 0o000);

        try {
            await expect(findRoutierPackages(root)).rejects.toThrow('EACCES');
        } finally {
            chmodSync(join(root, 'node_modules/@routier'), 0o755);
        }
    });
});

describe('resolvePackage', () => {
    it('resolves a package to its entry file from the project folder', () => {
        install(root, 'fake-store');

        expect(resolvePackage('@routier/fake-store', root)).toBe(join(root, 'node_modules/@routier/fake-store/main.js'));
    });
});
