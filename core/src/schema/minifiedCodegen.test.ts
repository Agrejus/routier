import { describe, expect, it } from '@jest/globals';
import { build, type BuildOptions } from 'esbuild';
import path from 'node:path';

/**
 * Schemas compile to generated source at runtime, and that source has to survive whatever a
 * consumer's bundler does to the library around it (#40, #46).
 *
 * The unit suites cannot see this: they run the TypeScript as written, where every identifier
 * keeps its source name and every arrow stays an arrow. So this bundles a schema from core
 * SOURCE with esbuild under each transformation a production build applies, runs the bundle, and
 * checks the compiled schema still does its job. Evaluated through `new Function` rather than as a
 * script, so module-level declarations stay module-scoped — a generated function that reaches
 * one by name fails here the way it does in a real ES module.
 */

const schemaDirectory = path.resolve(__dirname);

const entry = `
import { s } from "./index";

// Module-level, so a default that calls it only works if the default is bound by value.
function makeLabel(suffix) {
    return "label-" + suffix;
}

const counter = { value: 0 };

const schema = s.define("things", {
    id: s.string().key().identity(),
    name: s.string(),
    nested: s.object({
        a: s.string(),
        b: s.number().nullable(),
    }),
    tags: s.object({ note: s.string().nullable() }).array(),
    createdAt: s.date().default(() => new Date("2020-01-01T00:00:00.000Z")),
    label: s.string().default(() => makeLabel(++counter.value)),
    injectedDefault: s.number().default((injected) => injected.base + 1, { base: 41 }),
    stamp: s.number().deserialize((value) => Number(String(value).slice(2))).serialize((value) => "n:" + value),
    functionDefault: s.string().default(function () { return makeLabel("fn"); }),
}).modify((x) => ({
    upper: x.computed((entity) => entity.name.toUpperCase()),
    scaled: x.computed((entity, collectionName, injected) => collectionName + ":" + entity.injectedDefault * injected.factor, { factor: 2 }),
    greet: x.function((entity) => (greeting) => greeting + " " + entity.name),
})).compile();

export function run() {
    const out = {};

    const enriched = schema.enrich({
        id: "a",
        name: "x",
        nested: { a: "one", b: null },
        tags: [{ note: null }],
        stamp: 7,
    }, "proxy");

    out.enriched = {
        createdAt: enriched.createdAt.toISOString(),
        label: enriched.label,
        injectedDefault: enriched.injectedDefault,
        functionDefault: enriched.functionDefault,
        upper: enriched.upper,
        scaled: enriched.scaled,
        greet: enriched.greet("hi"),
        dirtyBefore: enriched.__tracking__?.isDirty ?? false,
    };

    enriched.name = "y";
    enriched.nested.a = "two";
    enriched.tags.push({ note: "added" });
    out.tracking = {
        isDirty: enriched.__tracking__.isDirty,
        changed: Object.keys(enriched.__tracking__.changes).sort(),
    };

    const tracked = schema.enableChangeTracking(schema.clone({ ...enriched, __tracking__: undefined }));
    tracked.nested.b = 5;
    out.enableChangeTracking = { isDirty: tracked.__tracking__.isDirty };

    const plain = schema.enrich({ id: "b", name: "p", nested: { a: "n", b: 1 }, tags: [], stamp: 3 }, "diff");
    const serialized = schema.serialize(plain);
    out.serialized = { stamp: serialized.stamp, createdAt: serialized.createdAt };

    const deserialized = schema.deserialize(serialized);
    out.deserialized = { stamp: deserialized.stamp, createdAt: deserialized.createdAt instanceof Date };

    const preprocessed = schema.preprocess(plain);
    out.preprocessed = { stamp: preprocessed.stamp, hasUpper: "upper" in preprocessed };

    const postprocessed = schema.postprocess(serialized, "proxy");
    postprocessed.name = "changed";
    out.postprocessed = {
        stamp: postprocessed.stamp,
        createdAt: postprocessed.createdAt instanceof Date,
        upper: postprocessed.upper,
        isDirty: postprocessed.__tracking__.isDirty,
    };

    const destination = schema.enrich({ id: "b", name: "p", nested: { a: "n", b: 1 }, tags: [], stamp: 3 }, "proxy");
    schema.merge(destination, { ...plain, name: "merged" });
    out.merged = { name: destination.name, upper: destination.upper, isDirty: destination.__tracking__?.isDirty ?? false };

    const cloned = schema.clone(plain);
    out.clone = { equal: schema.compare(cloned, plain), distinct: cloned.nested !== plain.nested };
    out.compareIds = schema.compareIds(plain, cloned);
    out.hash = typeof schema.hash(plain, "Entity") === "string";
    out.getId = schema.getId(plain);
    out.strip = Object.keys(schema.strip(plain)).includes("id");
    out.frozen = Object.isFrozen(schema.freeze(schema.clone(plain)));

    return JSON.stringify(out);
}
`;

const variants: Record<string, BuildOptions> = {
    "unminified": {},
    "minify": { minify: true },
    "minifyIdentifiers": { minifyIdentifiers: true },
    "arrows lowered": { supported: { arrow: false } },
    "minify + arrows lowered": { minify: true, supported: { arrow: false } },
};

const bundleAndRun = async (options: BuildOptions) => {
    const result = await build({
        stdin: { contents: entry, resolveDir: schemaDirectory, loader: 'js', sourcefile: 'minifiedCodegenEntry.js' },
        bundle: true,
        platform: 'node',
        format: 'cjs',
        write: false,
        logLevel: 'silent',
        ...options,
    });

    const module = { exports: {} as { run: () => string } };
    new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);

    return JSON.parse(module.exports.run());
};

const expected = {
    enriched: {
        createdAt: "2020-01-01T00:00:00.000Z",
        label: "label-1",
        injectedDefault: 42,
        functionDefault: "label-fn",
        upper: "X",
        scaled: "things:84",
        greet: "hi x",
        dirtyBefore: false,
    },
    tracking: { isDirty: true, changed: ["name", "nested.a", "tags.1"] },
    enableChangeTracking: { isDirty: true },
    serialized: { stamp: "n:3", createdAt: "2020-01-01T00:00:00.000Z" },
    deserialized: { stamp: 3, createdAt: true },
    preprocessed: { stamp: "n:3", hasUpper: false },
    postprocessed: { stamp: 3, createdAt: true, upper: "P", isDirty: true },
    merged: { name: "merged", upper: "MERGED", isDirty: false },
    clone: { equal: true, distinct: true },
    compareIds: true,
    hash: true,
    getId: "b",
    strip: false,
    frozen: true,
};

describe("schema codegen under production bundling (#40, #46)", () => {

    for (const [name, options] of Object.entries(variants)) {
        it(`compiles and runs a schema when bundled: ${name}`, async () => {
            expect(await bundleAndRun(options)).toEqual(expected);
        }, 30000);
    }
});
