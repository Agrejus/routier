import { describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import { DOMAINS, Domain, domainFor, renderDomainDoc } from "./domains";

/**
 * The manifest, enforced.
 *
 * `specs/core-agnosticism.md` ends with a grep somebody has to remember to run. Every
 * violation it documents got in because nobody ran it — each fix was two lines and obviously
 * correct in isolation. These tests are that grep, promoted to something that fails.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const IGNORED_DIRECTORIES = new Set([
    "node_modules", "dist", "coverage", ".git", ".stryker-tmp", "browser", "docs", "specs",
    "scripts", ".github", ".vscode", "public", "build", ".next",
    // Test support that is not shipped. A fixture legitimately builds a store over the
    // plugin it is exercising, which would otherwise read as a plugin depending on the
    // datastore.
    "tests", "__tests__",
]);

/**
 * Comments removed, so a rule is about CODE rather than prose.
 *
 * This matters more than it looks. Explaining why a concept is absent — why a delta is not a
 * column list, why a plugin serialises write order the way one engine forced — is exactly the
 * commentary worth keeping, and a rule that punished it would train people to delete the
 * explanation instead of the dependency. A type or an import named after an engine survives
 * this strip and is still caught.
 */
function codeOf(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Every `.ts`/`.tsx` file under a directory, repo-relative, excluding tests. */
function sourceFilesUnder(directory: string): string[] {
    const absolute = path.join(REPO_ROOT, directory);

    if (fs.existsSync(absolute) === false) {
        return [];
    }

    const found: string[] = [];

    const walk = (current: string) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (IGNORED_DIRECTORIES.has(entry.name) === false) {
                    walk(path.join(current, entry.name));
                }
                continue;
            }

            if (/\.tsx?$/.test(entry.name) && /\.test\.tsx?$/.test(entry.name) === false) {
                found.push(path.relative(REPO_ROOT, path.join(current, entry.name)));
            }
        }
    };

    walk(absolute);

    return found;
}

/** Only the files a domain owns directly — a child domain's files belong to the child. */
function filesOwnedBy(domain: Domain): string[] {
    return domain.paths
        .flatMap(sourceFilesUnder)
        .filter(file => domainFor(path.dirname(file))?.id === domain.id);
}

/**
 * The `@routier/*` name of the package a file lives in, read from the nearest package.json.
 */
function ownPackageNames(file: string): string[] {
    const names: string[] = [];
    let directory = path.dirname(path.join(REPO_ROOT, file));

    while (directory.startsWith(REPO_ROOT)) {
        const manifest = path.join(directory, "package.json");

        if (fs.existsSync(manifest)) {
            const name = JSON.parse(fs.readFileSync(manifest, "utf8")).name;

            if (typeof name === "string") {
                names.push(name);
            }
        }

        directory = path.dirname(directory);
    }

    return names;
}

describe("domain manifest", () => {

    it("declares no duplicate ids", () => {
        const ids = DOMAINS.map(d => d.id);

        expect(ids).toEqual([...new Set(ids)]);
    });

    it("points every declared path at a directory that exists", () => {
        const missing = DOMAINS.flatMap(d =>
            d.paths
                .filter(p => fs.existsSync(path.join(REPO_ROOT, p)) === false)
                .map(p => `${d.id} -> ${p}`)
        );

        expect(missing).toEqual([]);
    });

    /**
     * The orphan check, and the reason a new package cannot quietly appear.
     *
     * A directory nobody claimed is code whose purpose was never written down. The failure
     * arrives while the person who knows the answer is still the one holding it.
     */
    it("assigns every workspace source directory to a domain", () => {
        const workspaceRoots = ["core", "datastore", "react", "sync-server", "test-utils",
            "e2e", "stress", "benchmark", "architecture"];
        const pluginRoots = fs
            .readdirSync(path.join(REPO_ROOT, "plugins"), { withFileTypes: true })
            .filter(e => e.isDirectory() && IGNORED_DIRECTORIES.has(e.name) === false)
            .map(e => `plugins/${e.name}`);

        // A domain declares the SOURCE directory (`core/src`), so the package root itself is
        // resolved through it rather than claimed twice.
        const unclaimed = [...workspaceRoots, ...pluginRoots]
            .map(root => fs.existsSync(path.join(REPO_ROOT, root, "src")) ? `${root}/src` : root)
            .filter(directory => domainFor(directory) == null);

        expect(unclaimed).toEqual([]);
    });
});

/**
 * Anything still claimed by the `plugins` domain has to actually be one.
 *
 * `plugins/` holds two different things: backends that implement `IDbPlugin`, and libraries
 * that only translate (`sql-core`, `mongodb`) or supply a transform (`encryption`). Both are
 * legitimate; conflating them is not. The charter for `plugins` says "Implements IDbPlugin",
 * and three packages quietly did not — `encryption` most sharply, because it USED to be a
 * wrapper plugin and stopped being one without the directory changing.
 *
 * A library therefore has to declare its own domain, which is a sentence someone has to
 * write. Falling through to `plugins` now means claiming to be a backend.
 */
describe("packages under plugins/", () => {

    const IMPLEMENTS = /implements\s+IDbPlugin|extends\s+EphemeralDataPlugin|:\s*IDbPlugin\b/;

    it("implement IDbPlugin unless they declare a domain of their own", () => {
        const notPlugins = fs
            .readdirSync(path.join(REPO_ROOT, "plugins"), { withFileTypes: true })
            .filter(entry => entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name) === false)
            .filter(entry => domainFor(`plugins/${entry.name}`)?.id === "plugins")
            .filter(entry =>
                sourceFilesUnder(`plugins/${entry.name}/src`).some(file =>
                    IMPLEMENTS.test(fs.readFileSync(path.join(REPO_ROOT, file), "utf8"))
                ) === false
            )
            .map(entry => `plugins/${entry.name}`);

        expect(notPlugins).toEqual([]);
    });
});

describe("domain documentation", () => {

    /**
     * A generated doc, checked rather than trusted.
     *
     * The alternative — writing the charter twice, once in the manifest and once in prose —
     * drifts the first time somebody edits one of them, and a stale charter is worse than
     * none because it is believed.
     */
    it.each(DOMAINS.map(d => [d.id, d] as const))(
        "%s has a DOMAIN.md matching the manifest",
        (_id, domain) => {
            const docPath = path.join(REPO_ROOT, domain.paths[0], "DOMAIN.md");

            expect(fs.existsSync(docPath)).toBe(true);
            expect(fs.readFileSync(docPath, "utf8")).toBe(renderDomainDoc(domain));
        }
    );
});

describe("vocabulary", () => {

    const withVocabulary = DOMAINS.filter(d => d.forbiddenVocabulary != null);

    it.each(withVocabulary.map(d => [d.id, d] as const))(
        "%s names nothing it is not allowed to name",
        (_id, domain) => {
            const violations: string[] = [];

            for (const rule of domain.forbiddenVocabulary!) {
                const expression = new RegExp(rule.pattern, "i");

                for (const file of filesOwnedBy(domain)) {
                    if (rule.allowedIn?.includes(file)) {
                        continue;
                    }

                    const match = expression.exec(codeOf(fs.readFileSync(path.join(REPO_ROOT, file), "utf8")));

                    if (match != null) {
                        violations.push(`${file} says "${match[0]}" — ${rule.why}`);
                    }
                }
            }

            expect(violations).toEqual([]);
        }
    );
});

describe("dependency direction", () => {

    const IMPORT = /from\s+["'](@routier\/[^"'/]+)/g;

    const restricted = DOMAINS.filter(d => d.mayImport != null);

    it.each(restricted.map(d => [d.id, d] as const))(
        "%s imports only what it is allowed to",
        (_id, domain) => {
            const violations: string[] = [];

            for (const file of filesOwnedBy(domain)) {
                const text = codeOf(fs.readFileSync(path.join(REPO_ROOT, file), "utf8"));

                for (const [, packageName] of text.matchAll(IMPORT)) {
                    if (domain.mayImport!.includes(packageName)) {
                        continue;
                    }

                    // A package referring to itself by name is not a direction violation.
                    // `plugins/sqlite/src/index.ts` imports `@routier/sqlite-plugin` for its
                    // own public types, which is a resolution choice, not a dependency.
                    if (ownPackageNames(file).includes(packageName)) {
                        continue;
                    }

                    violations.push(`${file} imports ${packageName}`);
                }
            }

            expect(violations).toEqual([]);
        }
    );
});

/**
 * The frozen contract, asserted against the source.
 *
 * "IDbPlugin will never have any more functionality than it has now. It doesn't need it."
 * A fourth method is the moment that stops being true, and it would arrive looking
 * reasonable. A feature that seems to need one is either a wrapper plugin or a translator.
 */
describe("IDbPlugin is frozen", () => {

    it("declares exactly identity, query, destroy and bulkPersist", () => {
        const source = fs.readFileSync(
            path.join(REPO_ROOT, "core/src/plugins/types.ts"),
            "utf8"
        );

        const body = /export interface IDbPlugin \{([\s\S]*?)\n\}/.exec(source)?.[1];

        expect(body).toBeDefined();

        // Member names at the interface's top level: `name(` for a method, `name?:`/`name:`
        // for a property. Comment bodies are stripped first so prose cannot register.
        const withoutComments = body!.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
        const members = [...withoutComments.matchAll(/^\s{4}(?:readonly\s+)?(\w+)\s*[<(?:]/gm)]
            .map(match => match[1]);

        expect(new Set(members)).toEqual(new Set(["identity", "query", "destroy", "bulkPersist"]));
    });
});
