export type PackageDeclarations = {
    name: string;
    entry: string;
    subpaths: Readonly<Record<string, string>>;
    files: Readonly<Record<string, string>>;
};

export type DeclarationFile = { path: string; content: string };

const IMPORTED = /(?:from|import)\s+['"]([^'"]+)['"]/g;

const EXTERNALS_PATH = 'file:///node_modules/@types/playground-externals/index.d.ts';

const isShipped = (specifier: string, shipped: readonly string[]): boolean =>
    shipped.some(name => specifier === name || specifier.startsWith(`${name}/`));

const externalImports = (packages: readonly PackageDeclarations[], shipped: readonly string[]): string[] => {
    const found = packages.flatMap(pkg => Object.values(pkg.files).flatMap(content => Array.from(content.matchAll(IMPORTED)).flatMap(match => match.slice(1))));

    return [...new Set(found.filter(specifier => !specifier.startsWith('.') && !isShipped(specifier, shipped)))].sort();
};

const filesOf = (pkg: PackageDeclarations): DeclarationFile[] => [
    ...Object.entries(pkg.files).map(([file, content]) => ({ path: `file:///node_modules/${pkg.name}/dist/${file}`, content })),
    { path: `file:///node_modules/${pkg.name}/index.d.ts`, content: `export * from "./dist/${pkg.entry}";\n` },
    ...Object.entries(pkg.subpaths).map(([subpath, target]) => ({
        path: `file:///node_modules/${pkg.name}/${subpath}/index.d.ts`,
        content: `export * from "../dist/${target}";\n`,
    })),
];

export const declarationsFor = (packages: readonly PackageDeclarations[], alsoShipped: readonly string[]): DeclarationFile[] => {
    const shipped = [...packages.map(pkg => pkg.name), ...alsoShipped];
    const externals = externalImports(packages, shipped);

    return [
        ...packages.flatMap(filesOf),
        { path: EXTERNALS_PATH, content: externals.map(name => `declare module "${name}";\n`).join('') },
    ];
};
