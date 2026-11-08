import { statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const SCOPE = "@routier";
const SELF = `${SCOPE}/cli`;

const foldersUpFrom = (cwd: string): string[] => {
    const folders = [cwd];
    let parent = dirname(cwd);

    while (parent !== folders[folders.length - 1]) {
        folders.push(parent);
        parent = dirname(parent);
    }

    return folders;
};

const packagesIn = async (folder: string): Promise<string[]> => {
    const scope = join(folder, "node_modules", SCOPE);

    if (statSync(scope, { throwIfNoEntry: false })?.isDirectory() !== true) {
        return [];
    }

    const entries = await readdir(scope, { withFileTypes: true });

    return entries.filter(entry => entry.isDirectory() || entry.isSymbolicLink()).map(entry => `${SCOPE}/${entry.name}`);
};

export const findRoutierPackages = async (cwd: string): Promise<string[]> => {
    const found = await Promise.all(foldersUpFrom(cwd).map(packagesIn));

    return [...new Set(found.flat())].filter(name => name !== SELF).sort();
};

export const resolvePackage = (name: string, cwd: string): string =>
    createRequire(join(cwd, "package.json")).resolve(name);
