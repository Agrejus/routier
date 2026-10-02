import { HashType } from "@routier/core/schema";
import { describe, expect, it } from "@jest/globals";
import { generateData } from "./dataGenerator";
import { ShapeCase, shapeCatalog } from "./shapeCatalog";

/**
 * The generator invariants: properties that must hold for every compiled schema, asserted
 * across the whole shape catalog rather than one representative schema.
 *
 * Each invariant is named and asserted in exactly one place. When one fails, the shape name
 * and property order in the test title identify the input, so a failure is a reproduction
 * rather than a starting point for investigation.
 */
export const INVARIANTS = {
    roundtrip: "roundtrip",
    cloneIsolation: "clone-isolation",
    compareReflexive: "compare-reflexive",
    compareDiscriminates: "compare-discriminates",
    hashStable: "hash-stable",
    hashDiscriminates: "hash-discriminates",
    enrichDefaults: "enrich-defaults",
    enrichIdempotent: "enrich-idempotent",
    mergeTotal: "merge-total",
    stripRemoves: "strip-removes",
} as const;

export type InvariantName = typeof INVARIANTS[keyof typeof INVARIANTS];

/** Change-tracking bookkeeping that generators add and comparisons must ignore. */
const TRACKING_KEYS = new Set(["__tracking__", "__changeTracking__", "__proxy__"]);

/** Deep clone via plain structural copy, independent of the schema's own clone. */
function structuralCopy<T>(value: T): T {
    if (value === null || typeof value !== "object") {
        return value;
    }
    if (value instanceof Date) {
        return new Date(value.getTime()) as unknown as T;
    }
    if (Array.isArray(value)) {
        return value.map(structuralCopy) as unknown as T;
    }
    const copy: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        copy[key] = structuralCopy(inner);
    }
    return copy as T;
}

/** Strips tracking bookkeeping so structural comparisons reflect user data only. */
function withoutTracking<T>(value: T): T {
    if (value === null || typeof value !== "object" || value instanceof Date) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(withoutTracking) as unknown as T;
    }
    const copy: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        if (TRACKING_KEYS.has(key)) {
            continue;
        }
        copy[key] = withoutTracking(inner);
    }
    return copy as T;
}

type Reference = { path: string; value: object };

/** Collects every object/array reference reachable from a value, with its path. */
function collectReferences(value: unknown, path: string = "$", found: Reference[] = []): Reference[] {
    if (value === null || typeof value !== "object") {
        return found;
    }

    found.push({ path, value: value as object });

    if (value instanceof Date) {
        return found;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => collectReferences(item, `${path}[${index}]`, found));
        return found;
    }

    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        if (TRACKING_KEYS.has(key)) {
            continue;
        }
        collectReferences(inner, `${path}.${key}`, found);
    }

    return found;
}

/** Every leaf path holding a mutable, non-key value, used to perturb one property at a time. */
function mutableLeafPaths(entity: unknown, keyNames: Set<string>, path: string[] = [], found: string[][] = []): string[][] {
    if (entity === null || typeof entity !== "object" || entity instanceof Date) {
        if (path.length > 0) {
            found.push(path);
        }
        return found;
    }

    if (Array.isArray(entity)) {
        if (path.length > 0) {
            found.push(path);
        }
        return found;
    }

    for (const [key, inner] of Object.entries(entity as Record<string, unknown>)) {
        if (TRACKING_KEYS.has(key)) {
            continue;
        }
        // Keys identify the entity: perturbing one makes it a different entity rather than
        // a changed one, which is not what compare/hash discrimination is about.
        if (path.length === 0 && keyNames.has(key)) {
            continue;
        }
        mutableLeafPaths(inner, keyNames, [...path, key], found);
    }

    return found;
}

function readPath(entity: any, path: string[]): unknown {
    return path.reduce((current, key) => (current == null ? current : current[key]), entity);
}

function writePath(entity: any, path: string[], value: unknown): void {
    const parent = path.slice(0, -1).reduce((current, key) => current[key], entity);
    parent[path[path.length - 1]] = value;
}

/** Produces a value that differs from the input but keeps its type. */
function perturb(value: unknown): unknown {
    if (typeof value === "string") {
        return `${value}-perturbed`;
    }
    if (typeof value === "number") {
        return value + 1;
    }
    if (typeof value === "boolean") {
        return !value;
    }
    if (value instanceof Date) {
        return new Date(value.getTime() + 86_400_000);
    }
    if (Array.isArray(value)) {
        return [...value, "perturbed"];
    }
    if (value === null) {
        return "perturbed";
    }
    return undefined;
}

function keyNamesOf(shapeCase: ShapeCase): Set<string> {
    return new Set(shapeCase.schema.idProperties.map(p => p.name));
}

/** True when this shape is documented as not yet satisfying the invariant. */
function isKnownFailing(shapeCase: ShapeCase, invariant: InvariantName): boolean {
    return (shapeCase.spec.knownFailing ?? []).includes(invariant);
}

/**
 * Registers one `it` per (shape, invariant). `it.failing` is used for documented gaps so
 * they stay visible in the report and flip loudly — and fail the suite — once fixed.
 */
function testFor(shapeCase: ShapeCase, invariant: InvariantName, body: () => void) {
    const register = isKnownFailing(shapeCase, invariant) ? it.failing : it;
    register(`${invariant}: ${shapeCase.name}`, body);
}

/**
 * A freshly generated entity in *application* shape — properties under their declared
 * names, defaults already filled in by the generator.
 *
 * Deliberately not passed through `prepare()`. `prepare` applies defaults *and* rewrites
 * `from()` properties to their wire names, so a prepared entity is already half-serialized;
 * feeding it to `preprocess` renames twice and drops the value. The application shape is
 * the right baseline for clone/compare/hash/merge/strip, and the right input to preprocess.
 */
function sampleEntity(shapeCase: ShapeCase): any {
    const [created] = generateData(shapeCase.schema, 1) as any[];
    return structuralCopy(created);
}

/**
 * Runs the invariant suite over the given cases.
 *
 * @param cases Catalog cases to cover. Defaults to the whole catalog.
 */
export function describeGeneratorInvariants(cases: readonly ShapeCase[] = shapeCatalog()) {
    describe("roundtrip", () => {
        for (const shapeCase of cases) {
            testFor(shapeCase, INVARIANTS.roundtrip, () => {
                const { schema } = shapeCase;
                const entity = sampleEntity(shapeCase);

                const wire = schema.preprocess(structuralCopy(entity));
                const returned = schema.deserialize(structuralCopy(wire) as any);

                // Compared without tracking metadata: the round trip must preserve user
                // data, and bookkeeping added on the way back is not user data.
                expect(withoutTracking(returned)).toEqual(withoutTracking(entity));
            });
        }
    });

    describe("clone-isolation", () => {
        for (const shapeCase of cases) {
            testFor(shapeCase, INVARIANTS.cloneIsolation, () => {
                const { schema } = shapeCase;
                const entity = sampleEntity(shapeCase);
                const cloned = schema.clone(structuralCopy(entity));

                expect(withoutTracking(cloned)).toEqual(withoutTracking(entity));

                // Equal contents are not enough: a clone sharing a nested reference lets a
                // mutation of the copy write through to the original. Compare identities at
                // every depth, not just the root.
                const originalRefs = collectReferences(entity);
                const clonedRefs = collectReferences(cloned);
                const sharedIdentities = new Set(originalRefs.map(r => r.value));

                for (const ref of clonedRefs) {
                    if (sharedIdentities.has(ref.value)) {
                        throw new Error(`clone shares a reference with the original at ${ref.path}`);
                    }
                }
            });
        }
    });

    describe("compare-reflexive", () => {
        for (const shapeCase of cases) {
            testFor(shapeCase, INVARIANTS.compareReflexive, () => {
                const { schema } = shapeCase;
                const entity = sampleEntity(shapeCase);

                expect(schema.compare(entity, entity)).toBe(true);
                expect(schema.compare(schema.clone(structuralCopy(entity)), entity)).toBe(true);
            });
        }
    });

    describe("compare-discriminates", () => {
        for (const shapeCase of cases) {
            testFor(shapeCase, INVARIANTS.compareDiscriminates, () => {
                const { schema } = shapeCase;
                const entity = sampleEntity(shapeCase);
                const paths = mutableLeafPaths(entity, keyNamesOf(shapeCase));

                if (paths.length === 0) {
                    // Key-only shapes have nothing to perturb; reflexivity already covers them.
                    return;
                }

                for (const path of paths) {
                    const mutated = structuralCopy(entity);
                    const next = perturb(readPath(mutated, path));

                    if (next === undefined) {
                        continue;
                    }

                    writePath(mutated, path, next);

                    expect({
                        path: path.join("."),
                        equal: schema.compare(mutated, entity),
                    }).toEqual({ path: path.join("."), equal: false });
                }
            });
        }
    });

    describe("hash-stable", () => {
        for (const shapeCase of cases) {
            testFor(shapeCase, INVARIANTS.hashStable, () => {
                const { schema } = shapeCase;
                const entity = sampleEntity(shapeCase);
                const cloned = schema.clone(structuralCopy(entity));

                expect(schema.hash(cloned, HashType.Object)).toBe(schema.hash(entity, HashType.Object));
                expect(schema.hash(cloned as any, HashType.Ids)).toBe(schema.hash(entity as any, HashType.Ids));
            });
        }
    });

    describe("hash-discriminates", () => {
        for (const shapeCase of cases) {
            testFor(shapeCase, INVARIANTS.hashDiscriminates, () => {
                const { schema } = shapeCase;
                const entity = sampleEntity(shapeCase);
                const paths = mutableLeafPaths(entity, keyNamesOf(shapeCase));

                if (paths.length === 0) {
                    return;
                }

                // HashType.Object hashes entity content; HashType.Ids hashes only keys, so
                // it is deliberately not expected to discriminate on non-key changes.
                const baseline = schema.hash(entity, HashType.Object);

                for (const path of paths) {
                    const mutated = structuralCopy(entity);
                    const next = perturb(readPath(mutated, path));

                    if (next === undefined) {
                        continue;
                    }

                    writePath(mutated, path, next);

                    expect({
                        path: path.join("."),
                        same: schema.hash(mutated, HashType.Object) === baseline,
                    }).toEqual({ path: path.join("."), same: false });
                }
            });
        }
    });

    describe("enrich-defaults", () => {
        for (const shapeCase of cases) {
            testFor(shapeCase, INVARIANTS.enrichDefaults, () => {
                const { schema } = shapeCase;
                const withDefaults = schema.properties.filter(p => p.parent == null && p.defaultValue != null);

                if (withDefaults.length === 0) {
                    return;
                }

                // Absent properties receive their default. `enrich` is the entry point that
                // applies them (see EnrichmentDefaultValueHandler) — `prepare` handles
                // renames and shaping, not defaults.
                const bare: any = {};
                for (const keyProperty of schema.idProperties) {
                    bare[keyProperty.name] = "key-value";
                }

                const enriched: any = schema.enrich(bare, "diff");

                for (const property of withDefaults) {
                    expect({
                        property: property.name,
                        assigned: enriched[property.name],
                    }).not.toEqual({ property: property.name, assigned: undefined });
                }

                // Present values survive: a default must not overwrite what the caller set.
                // Falsy values are the interesting case — `||`-style guards silently replace
                // false, 0, and "" with the default.
                const explicit = sampleEntity(shapeCase);
                const reEnriched: any = schema.enrich(structuralCopy(explicit), "diff");

                for (const property of withDefaults) {
                    if (!(property.name in (explicit as Record<string, unknown>))) {
                        continue;
                    }
                    expect({
                        property: property.name,
                        value: reEnriched[property.name],
                    }).toEqual({
                        property: property.name,
                        value: (explicit as Record<string, unknown>)[property.name],
                    });
                }
            });
        }
    });

    describe("enrich-idempotent", () => {
        for (const shapeCase of cases) {
            testFor(shapeCase, INVARIANTS.enrichIdempotent, () => {
                const { schema } = shapeCase;
                const entity = sampleEntity(shapeCase);

                const once = schema.enrich(structuralCopy(entity) as any, "diff");
                const twice = schema.enrich(structuralCopy(once) as any, "diff");

                expect(withoutTracking(twice)).toEqual(withoutTracking(once));
            });
        }
    });

    describe("merge-total", () => {
        for (const shapeCase of cases) {
            testFor(shapeCase, INVARIANTS.mergeTotal, () => {
                const { schema } = shapeCase;
                const entity = sampleEntity(shapeCase);

                const destination: any = {};
                schema.merge(destination, structuralCopy(entity) as any);

                // Merging into an empty destination must reproduce the source: anything the
                // merge generator fails to copy is data lost on every update path.
                expect(withoutTracking(destination)).toEqual(withoutTracking(entity));
            });
        }
    });

    describe("strip-removes", () => {
        for (const shapeCase of cases) {
            testFor(shapeCase, INVARIANTS.stripRemoves, () => {
                const { schema } = shapeCase;
                const entity = sampleEntity(shapeCase);
                const stripped: any = schema.strip(structuralCopy(entity));

                for (const keyProperty of schema.idProperties) {
                    const name = keyProperty.from ?? keyProperty.name;
                    expect(name in stripped).toBe(false);
                }

                for (const property of schema.properties) {
                    if (property.parent != null) {
                        continue;
                    }
                    if (property.isUnmapped !== true) {
                        continue;
                    }
                    const name = property.from ?? property.name;
                    expect(name in stripped).toBe(false);
                }
            });
        }
    });
}
