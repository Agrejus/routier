/**
 * What each part of this repository is responsible for.
 *
 * This file is the single source of truth. Two things read it:
 *
 * 1. `writeDomainDocs.ts` renders a `DOMAIN.md` into every domain directory, so a file's
 *    charter is readable next to the file rather than only from here.
 * 2. `domains.test.ts` enforces it — orphaned directories, forbidden vocabulary, dependency
 *    direction, and a `DOMAIN.md` that has drifted all fail the suite.
 *
 * Writing the rules down is not the point. The point is that they are CHECKED. The rule that
 * core stays storage-agnostic already existed in `specs/core-agnosticism.md` as a grep
 * somebody had to remember to run; the SQL-in-core violations it documents arrived one
 * plausible bug fix at a time, each individually defensible. `domains.test.ts` is that grep,
 * promoted to something that fails.
 *
 * ## Adding a domain
 *
 * A new package or top-level directory with no entry here fails `every source directory
 * belongs to exactly one domain`. That is deliberate: the failure is the prompt to say what
 * the new code is for, while the person who knows is still the one holding it.
 */

/** A vocabulary rule: a pattern that must not appear in a domain's source. */
export type VocabularyRule = {
    /** Matched case-insensitively against each source file's text. */
    readonly pattern: string;
    /** Why the word does not belong here. Shown in the failure message. */
    readonly why: string;
    /**
     * Repo-relative files allowed to mention it anyway.
     *
     * Prose explaining why a concept is *absent* is itself worth having — the delta docstring
     * in `core/src/plugins/types.ts` exists so the next person does not helpfully re-flatten
     * it into a column list.
     */
    readonly allowedIn?: readonly string[];
};

export type Domain = {
    /** Stable id, used in failure messages and as the doc anchor. */
    readonly id: string;
    readonly title: string;
    /**
     * Directories this domain owns, repo-relative, without a trailing slash.
     *
     * Resolution is LONGEST PREFIX WINS, so a child directory may declare its own domain
     * while its parent still covers everything else.
     */
    readonly paths: readonly string[];
    /** One sentence: what this domain is responsible for. */
    readonly responsibility: string;
    /** The rules that hold inside it. Prose, because most are not mechanically checkable. */
    readonly rules: readonly string[];
    /** Checked against the domain's source text. */
    readonly forbiddenVocabulary?: readonly VocabularyRule[];
    /**
     * `@routier/*` packages this domain's source may import.
     *
     * Absent means unrestricted — appropriate for test and tooling domains, which legitimately
     * reach for everything. An empty array means it may import no workspace package at all,
     * which is what makes core the bottom of the graph.
     */
    readonly mayImport?: readonly string[];
};

/** Engine and storage-technology names. A hit in an agnostic domain is the violation. */
const ENGINE_NAMES: readonly VocabularyRule[] = [
    {
        pattern: "\\b(sqlite|postgres|postgresql|mysql|mssql|mongodb|pouchdb|dexie|indexeddb)\\b",
        why: "Naming an engine here makes the data model depend on one place data can live. Translating the model into an engine's terms is a plugin's entire reason to exist.",
        allowedIn: [
            // Prose about why the delta is NOT storage-shaped. Defect #13 was somebody
            // helpfully re-flattening it into a column list.
            "core/src/plugins/types.ts",
        ],
    },
];

/** SQL vocabulary. Separate from engine names because a plugin may name SQL but not an engine. */
const SQL_VOCABULARY: readonly VocabularyRule[] = [
    {
        pattern: "\\b(SELECT \\*|INSERT INTO|CREATE TABLE|WHERE clause|dialect)\\b",
        why: "A statement or a column is a fact about storage, not about the data model.",
        allowedIn: ["core/src/plugins/types.ts"],
    },
];

export const DOMAINS: readonly Domain[] = [
    // ---------------------------------------------------------------- the model

    {
        id: "core",
        title: "Core — the data model",
        paths: ["core/src"],
        responsibility:
            "Describes the data model and nothing about storage: schemas, properties, expressions, change sets, results.",
        rules: [
            "May describe the data model. May not describe storage — no column, no statement, no driver quirk, no type named after an engine.",
            "Imports no workspace package. It is the bottom of the dependency graph, and everything else may depend on it.",
            "The useful question during a fix is not 'is this the smallest change' but 'is this a fact about the data model, or a fact about a database?'",
            "See specs/core-agnosticism.md for the violations that arrived before this was enforced, and how each was moved out.",
        ],
        forbiddenVocabulary: [...ENGINE_NAMES, ...SQL_VOCABULARY],
        mayImport: [],
    },
    {
        id: "expressions",
        title: "Expressions — the agnostic query language",
        paths: ["core/src/expressions"],
        responsibility:
            "The agnostic query language the datastore speaks. A plugin translates it into whatever query language its backend expects.",
        rules: [
            "An expression is a filter as the data model sees it: property, value, comparator, logical operator, transformer. It knows nothing about how any backend will run it.",
            "Every backend receives the SAME expression tree. Turning it into SQL, MQL, or a JavaScript predicate is the plugin's job — see toSql in @routier/sql-plugin-core and toMql in @routier/mongodb-plugin for two worked examples.",
            "A filter core cannot parse becomes a not-parsable node, and QueryOptionsCollection routes it to the memory execution target. A plugin never has to invent a fallback.",
            "Adding a comparator here obliges every plugin's translator to answer it, or to refuse it loudly. Refusing beats returning the wrong rows.",
        ],
        forbiddenVocabulary: [...ENGINE_NAMES, ...SQL_VOCABULARY],
        mayImport: [],
    },
    {
        id: "schema",
        title: "Schema and PropertyInfo",
        paths: ["core/src/schema"],
        responsibility:
            "Defines what an entity is. PropertyInfo carries a property and its metadata; a schema is modified through .modify().",
        rules: [
            "PropertyInfo is the properties and their metadata on a schema — type, key, identity, nullability, renames, indexes, serializers.",
            "A schema is changed through .modify(), not by mutating a compiled schema. A compiled schema is a read-only fact that plugins and codegen both depend on.",
            "getResolvedName() returns the LEAF storage name. A nested property's full location also needs getParentPathArray({ useFromPropertyName: true }); using the leaf alone is how a nested filter came to name a column that does not exist.",
            "A wrapper plugin may hand its inner plugin a schema view with synthetic properties appended. ConcurrencyDbPlugin is the reference for that technique.",
        ],
        forbiddenVocabulary: [...ENGINE_NAMES, ...SQL_VOCABULARY],
        mayImport: [],
    },
    {
        id: "collections",
        title: "Collections",
        paths: ["core/src/collections"],
        responsibility: "A way to define a collection, and to carry the pending changes against one.",
        rules: [
            "A collection names a set of entities of one schema. It is a data-model concept: it does not know whether the backend calls it a table, a store, or a document collection.",
            "Change sets belong here too — adds, updates and removes are described in entity terms, and a plugin decides what statement or operation each becomes.",
        ],
        forbiddenVocabulary: [...ENGINE_NAMES, ...SQL_VOCABULARY],
        mayImport: [],
    },
    {
        id: "plugin-contract",
        title: "The plugin contract",
        paths: ["core/src/plugins"],
        responsibility:
            "The interface every backend implements, and the query options a datastore hands it.",
        rules: [
            "IDbPlugin is FROZEN at query, destroy and bulkPersist, plus an optional identity. It will never gain functionality — it does not need any. A feature that seems to need a fourth method is either a wrapper plugin or a translator.",
            "A wrapper plugin implements IDbPlugin and holds another IDbPlugin. That is what makes a feature work across every backend at once instead of once per backend.",
            "QueryOptionsCollection decides per option whether it runs in the database or in memory. A plugin overrides only what it can genuinely push down; everything else is already handled.",
        ],
        forbiddenVocabulary: [...ENGINE_NAMES, ...SQL_VOCABULARY],
        mayImport: [],
    },
    {
        id: "translators",
        title: "Translators — database response to model",
        paths: ["core/src/plugins/translators"],
        responsibility:
            "Convert a response from a database into something the datastore recognizes.",
        rules: [
            "A translator runs on the way BACK. Expressions go out to the plugin; a translator brings rows or records home.",
            "JsonTranslator evaluates every query option in memory by default. A plugin subclasses it and overrides only the options its backend actually applied, checking option.target — DexieTranslator is the smallest worked example.",
            "SqlTranslator stays in core deliberately: it encodes that aggregate results arrive as rows, which is a shape convention and names no engine. A driver that deviates overrides it in its own plugin — see PostgresSqlTranslator and its bigint COUNT branch.",
        ],
        forbiddenVocabulary: ENGINE_NAMES,
        mayImport: [],
    },

    // ---------------------------------------------------------------- the abstraction

    {
        id: "datastore",
        title: "Datastore — the CRUD abstraction",
        paths: ["datastore/src"],
        responsibility:
            "The CRUD abstraction that routes everything to the plugins. Everything it does is agnostic and done in its own way; that way is what gets passed to a plugin.",
        rules: [
            "It is the only thing callers talk to. It tracks changes, resolves queries, and hands work to a plugin through IDbPlugin.",
            "Everything it does is agnostic. It speaks expressions, schemas, collections and change sets — never a query language.",
            "Translating its way into a query language is the PLUGIN's responsibility, never this package's. If something here starts to look engine-shaped, it belongs in a plugin.",
            "It does not choose a backend. Which plugin it routes to is the caller's decision, which is why the same store runs against nine of them.",
        ],
        forbiddenVocabulary: [...ENGINE_NAMES, ...SQL_VOCABULARY],
        mayImport: ["@routier/core"],
    },

    // ---------------------------------------------------------------- storage

    {
        id: "plugins",
        title: "Plugins — where data lives, and translation into a query language",
        paths: ["plugins"],
        responsibility:
            "Implements IDbPlugin. Translates the agnostic form the datastore passes down into the query language its backend expects.",
        rules: [
            "A BACKEND plugin adds one more place data can live. A WRAPPER plugin wraps another IDbPlugin and works with every backend at once — prefer a wrapper whenever the feature is not about where bytes live.",
            "Translating an expression into a query language happens HERE, once per query language. Not in core, and not in the datastore.",
            "A query it cannot answer correctly must throw. Silently widening a filter returns wrong rows; silently falling back to a scan turns a bounded query into a full one. Both are worse than refusing.",
            "Never duplicate a shared builder. The MySQL plugin kept its own copy of toSql and drifted into three defects — ignored .from() renames, unescaped LIKE literals, and no JSON path — none of which were MySQL requirements.",
            "Engine-specific knowledge belongs on a dialect or a driver, stated once, so DDL and query generation cannot disagree.",
        ],
        mayImport: [
            "@routier/core",
            "@routier/sql-plugin-core",
            "@routier/blob-plugin",
            "@routier/memory-plugin",
        ],
    },
    {
        id: "encryption",
        title: "Encryption — a transform, not a plugin",
        paths: ["plugins/encryption"],
        responsibility:
            "Supplies a two-way property transform that encrypts on the way out and decrypts on the way back.",
        rules: [
            "This implements no IDbPlugin and stores nothing. It lives under plugins/ for packaging reasons only.",
            "It was a wrapper plugin and is not one any more. Encryption is declared as .modify(x => x.transform({ to, from })) and runs in the datastore, which is why it needs no plugin at all — see datastore/src/transforms.",
            "Core ships no transform of its own. What runs here is supplied by the caller, including the keyring.",
        ],
        mayImport: ["@routier/core"],
    },
    {
        id: "mongodb",
        title: "MongoDB query translation",
        paths: ["plugins/mongodb"],
        responsibility:
            "Translates a core expression tree into an MQL filter document. The MongoDB counterpart of toSql.",
        rules: [
            "Translation only. There is no IDbPlugin here yet — no connection, no driver, no write path.",
            "A field must be a key in MQL, so a comparison with the property on the right is MIRRORED rather than emitted in source order. Getting that wrong returns the opposite rows from a query that still looks valid.",
            "A filter with no MQL form throws and names the memory execution target. It never widens the filter and never falls back to a scan.",
        ],
        mayImport: ["@routier/core"],
    },
    {
        id: "sql-core",
        title: "Shared SQL translation",
        paths: ["plugins/sql-core"],
        responsibility:
            "The SQL knowledge every SQL plugin shares: dialects, WHERE generation, column assignment, update batching.",
        rules: [
            "A dialect states what genuinely differs between engines — quoting, placeholders, LIKE versus GLOB, JSON column type and extraction, date literals. Stated once, so DDL and queries cannot drift apart.",
            "Every SQL plugin delegates here rather than reimplementing. A local expressionToWhereClause should be a one-line call to toSql, as SQLite's and PostgreSQL's are.",
            "A nested subtree is ONE JSON column named for its root. Filtering into it is a path, not a column — see jsonPathExpression.",
            "Shape assertions prove what the builder emits, not what an engine does with it. A change here needs e2e/src/dialectConformance.ts run against real engines, because SQLite forgives what PostgreSQL and MySQL do not.",
        ],
        mayImport: ["@routier/core"],
    },

    // ---------------------------------------------------------------- consumers

    {
        id: "react",
        title: "React bindings",
        paths: ["react/src"],
        responsibility: "Exposes a datastore to React components as hooks.",
        rules: [
            "Binds to the datastore's public surface only. A hook that needs plugin internals is a sign the datastore is missing something.",
            "Subscription and re-render behaviour lives here; change detection lives in the datastore.",
        ],
        mayImport: ["@routier/core", "@routier/datastore"],
    },
    {
        id: "sync-server",
        title: "Sync server",
        paths: ["sync-server/src"],
        responsibility: "Serves a datastore over HTTP so a remote client can read and write it.",
        rules: [
            "The wire format is a transport concern and stays here. It is not part of the data model.",
        ],
        mayImport: ["@routier/core", "@routier/datastore", "@routier/memory-plugin"],
    },

    // ---------------------------------------------------------------- verification

    {
        id: "e2e",
        title: "End-to-end and conformance",
        paths: ["e2e"],
        responsibility:
            "Runs the same matrix against every real engine, so a divergence between backends is a failure rather than a surprise.",
        rules: [
            "Every case here is a question every engine must answer the same way. A divergence is the finding.",
            "Assertions EXECUTE generated queries rather than compare them to snapshots. A string assertion cannot tell a valid statement from a correct one.",
            "SQLite always runs; container engines are gated behind E2E_CONTAINERS=1. SQLite passing is necessary and nowhere near sufficient — it forgives loose JSON typing, multi-statement calls, and file-level write serialization.",
        ],
    },
    {
        id: "stress",
        title: "Stress and volume",
        paths: ["stress"],
        responsibility: "Finds the defects that only appear under real load, churn, or concurrency.",
        rules: [
            "Gated behind STRESS=1, so a default run lists these as skipped rather than executing them.",
            "A defect found here is reduced to its smallest form in e2e before it is fixed, so the guard survives after the load test stops being run.",
        ],
    },
    {
        id: "benchmark",
        title: "Benchmarks",
        paths: ["benchmark"],
        responsibility: "Measures performance. Only the harness is unit tested — a timing measurement is not a test.",
        rules: ["Run by npm run benchmark, not by Jest."],
    },
    {
        id: "test-utils",
        title: "Shared test utilities",
        paths: ["test-utils"],
        responsibility: "Fixtures, fakes and module shims the suites share.",
        rules: [
            "Nothing here ships. It exists so a test reads as the thing it is testing rather than as setup.",
        ],
    },
    {
        id: "architecture",
        title: "Architecture — this manifest and its enforcement",
        paths: ["architecture"],
        responsibility:
            "Holds what each domain is responsible for, renders it into each domain's DOMAIN.md, and fails the suite when the repository stops matching.",
        rules: [
            "domains.ts is the single source of truth. A DOMAIN.md is generated; edit the manifest and run npm run domains:write.",
            "A new package with no entry here fails the orphan check. That failure is the prompt to write down what the code is for.",
        ],
        mayImport: [],
    },
];

/**
 * The domain owning a repo-relative path, by longest matching prefix.
 *
 * Longest-prefix rather than first-match so a child may declare its own domain while its
 * parent still covers everything else: `core/src/expressions` resolves to `expressions`,
 * `core/src/results` falls through to `core`.
 */
export function domainFor(relativePath: string): Domain | undefined {
    let best: Domain | undefined;
    let bestLength = -1;

    for (const domain of DOMAINS) {
        for (const path of domain.paths) {
            const isMatch = relativePath === path || relativePath.startsWith(`${path}/`);

            if (isMatch && path.length > bestLength) {
                best = domain;
                bestLength = path.length;
            }
        }
    }

    return best;
}

/** The `DOMAIN.md` body for a domain. Generated — see writeDomainDocs.ts. */
export function renderDomainDoc(domain: Domain): string {
    const lines = [
        `# ${domain.title}`,
        "",
        "<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run",
        "     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->",
        "",
        "## Responsible for",
        "",
        domain.responsibility,
        "",
        "## Rules",
        "",
        ...domain.rules.map(rule => `- ${rule}`),
    ];

    if (domain.mayImport != null) {
        lines.push(
            "",
            "## May import",
            "",
            domain.mayImport.length === 0
                ? "No workspace package. This domain is a leaf of the dependency graph."
                : domain.mayImport.map(name => `\`${name}\``).join(", ")
        );
    }

    lines.push(
        "",
        "## Covers",
        "",
        ...domain.paths.map(path => `- \`${path}\``),
        ""
    );

    return lines.join("\n");
}
