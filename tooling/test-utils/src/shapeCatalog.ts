import { CompiledSchema, s } from "@routier/core/schema";

/**
 * A catalog of compiled schemas covering the property space, used to drive the generator
 * invariants over many shapes instead of one hand-picked schema.
 *
 * Two audits found bugs that a single-shape happy-path test could not see: silent property
 * omission in codegen, clone-by-reference, renamed-property data loss. All three were
 * shape-sensitive — they depended on a property's type, modifiers, nesting, or position.
 * So the catalog varies exactly those four dimensions, and every shape is a real
 * `compile()` output rather than a mock.
 */

/** A property factory. Deliberately `any` — the catalog mixes property types by design. */
type PropertyFactory = () => any;

/**
 * Properties in declaration order. Order is data here, not incidental: codegen walks
 * properties in declaration order, so the same property set in a different order is a
 * genuinely different input worth testing.
 */
export type PropertyList = [name: string, factory: PropertyFactory][];

export type ShapeSpec = {
    /** Stable identifier used in test names. */
    readonly name: string;
    /** Non-key properties. The key is supplied by the order strategy. */
    readonly properties: PropertyList;
    /** Freeform labels so invariants can select or skip subsets. */
    readonly tags?: readonly string[];
    /**
     * Invariants known not to hold for this shape yet. Listed here rather than skipped
     * silently, so the gap is visible and flips loudly when it is fixed.
     */
    readonly knownFailing?: readonly string[];
};

/**
 * Where the key sits relative to everything else. Codegen emits per-property handlers in
 * declaration order, so key position has repeatedly mattered to correctness.
 */
export type PropertyOrder = "key-first" | "key-last" | "object-first" | "date-first";

export const PROPERTY_ORDERS: readonly PropertyOrder[] = [
    "key-first",
    "key-last",
    "object-first",
    "date-first",
];

const KEY_PROPERTY: [string, PropertyFactory] = ["id", () => s.string().key()];

/** True when a factory produces a property of the given schema type. */
const isType = (factory: PropertyFactory, typeName: string) => {
    try {
        const built = factory();
        return String(built?.type ?? "").toLowerCase() === typeName;
    } catch {
        return false;
    }
};

/**
 * Applies an order strategy to a property list, returning the full declaration order
 * including the key.
 */
export function orderProperties(properties: PropertyList, order: PropertyOrder): PropertyList {
    const rest = [...properties];

    switch (order) {
        case "key-first":
            return [KEY_PROPERTY, ...rest];
        case "key-last":
            return [...rest, KEY_PROPERTY];
        case "object-first": {
            const objects = rest.filter(([, f]) => isType(f, "object"));
            const others = rest.filter(([, f]) => !isType(f, "object"));
            return [...objects, KEY_PROPERTY, ...others];
        }
        case "date-first": {
            const dates = rest.filter(([, f]) => isType(f, "date"));
            const others = rest.filter(([, f]) => !isType(f, "date"));
            return [...dates, KEY_PROPERTY, ...others];
        }
    }
}

/** Builds the plain object `s.define` expects from an ordered property list. */
function toDefinition(properties: PropertyList): Record<string, unknown> {
    const definition: Record<string, unknown> = {};

    for (const [name, factory] of properties) {
        definition[name] = factory();
    }

    return definition;
}

export type ShapeCase = {
    readonly spec: ShapeSpec;
    readonly order: PropertyOrder;
    /** `${spec.name} [${order}]` — used directly as a test name. */
    readonly name: string;
    readonly schema: CompiledSchema<any>;
    /** Declaration order actually used, so tests can assert against it. */
    readonly propertyNames: readonly string[];
};

/**
 * The shape specs. Each covers a distinct point in the type × modifier × placement space.
 *
 * Every spec keeps its own collection name derived from spec name + order, because a
 * schema's id is hashed from its property names and collection name — reusing one name
 * across orders would collide two different shapes onto one id.
 */
export const SHAPE_SPECS: readonly ShapeSpec[] = [
    // --- Scalars, bare ---
    { name: "string", properties: [["value", () => s.string()]], tags: ["scalar", "string"] },
    { name: "number", properties: [["value", () => s.number()]], tags: ["scalar", "number"] },
    { name: "boolean", properties: [["value", () => s.boolean()]], tags: ["scalar", "boolean"] },
    { name: "date", properties: [["value", () => s.date()]], tags: ["scalar", "date"] },

    // --- Scalars, nullable / optional ---
    { name: "string-nullable", properties: [["value", () => s.string().nullable()]], tags: ["scalar", "nullable"] },
    { name: "string-optional", properties: [["value", () => s.string().optional()]], tags: ["scalar", "optional"] },
    { name: "number-nullable", properties: [["value", () => s.number().nullable()]], tags: ["scalar", "nullable"] },
    { name: "number-optional", properties: [["value", () => s.number().optional()]], tags: ["scalar", "optional"] },
    { name: "boolean-nullable", properties: [["value", () => s.boolean().nullable()]], tags: ["scalar", "nullable"] },
    { name: "boolean-optional", properties: [["value", () => s.boolean().optional()]], tags: ["scalar", "optional"] },
    { name: "date-nullable", properties: [["value", () => s.date().nullable()]], tags: ["scalar", "nullable", "date"] },
    { name: "date-optional", properties: [["value", () => s.date().optional()]], tags: ["scalar", "optional", "date"] },

    // --- Defaults. A literal default and a function default take different codegen paths. ---
    { name: "string-default-literal", properties: [["value", () => s.string().default("fallback")]], tags: ["default"] },
    { name: "number-default-literal", properties: [["value", () => s.number().default(7)]], tags: ["default"] },
    { name: "boolean-default-false", properties: [["value", () => s.boolean().default(false)]], tags: ["default", "falsy"] },
    { name: "number-default-zero", properties: [["value", () => s.number().default(0)]], tags: ["default", "falsy"] },
    { name: "string-default-empty", properties: [["value", () => s.string().default("")]], tags: ["default", "falsy"] },
    { name: "string-default-fn", properties: [["value", () => s.string().default(() => "computed")]], tags: ["default"] },
    { name: "date-default-fn", properties: [["value", () => s.date().default(() => new Date("2020-01-01T00:00:00.000Z"))]], tags: ["default", "date"] },
    {
        name: "string-default-fn-injected",
        properties: [["value", () => s.string().default((injected: string) => `${injected}-value`, "seed")]],
        tags: ["default", "injected"],
    },

    // --- Renames. `from()` is where renamed-property data loss lived. ---
    { name: "string-renamed", properties: [["value", () => s.string().from("wire_value")]], tags: ["rename"] },
    { name: "number-renamed", properties: [["value", () => s.number().from("wire_number")]], tags: ["rename"] },
    { name: "date-renamed", properties: [["value", () => s.date().from("wire_date")]], tags: ["rename", "date"] },
    {
        name: "renamed-nullable",
        properties: [["value", () => s.string().from("wire_value").nullable()]],
        tags: ["rename", "nullable"],
    },

    // --- Serializers / deserializers ---
    {
        name: "serialized-number",
        properties: [["value", () => s.number().serialize(v => String(v)).deserialize(v => Number(v))]],
        tags: ["serializer"],
    },
    {
        name: "serialized-string",
        properties: [["value", () => s.string().serialize(v => `<${v}>`).deserialize(v => String(v).slice(1, -1))]],
        tags: ["serializer"],
    },

    // --- Indexes, distinct, readonly, tags ---
    { name: "string-indexed", properties: [["value", () => s.string().index("value_idx")]], tags: ["index"] },
    { name: "string-distinct", properties: [["value", () => s.string().distinct()]], tags: ["distinct"] },
    { name: "string-readonly", properties: [["value", () => s.string().readonly()]], tags: ["readonly"] },
    { name: "string-tagged", properties: [["value", () => s.string().tag("pii")]], tags: ["tag"] },

    // --- Arrays of each element type ---
    { name: "array-of-string", properties: [["values", () => s.array(s.string())]], tags: ["array"] },
    { name: "array-of-number", properties: [["values", () => s.array(s.number())]], tags: ["array"] },
    { name: "array-of-boolean", properties: [["values", () => s.array(s.boolean())]], tags: ["array"] },
    {
        name: "array-of-date",
        properties: [["values", () => s.array(s.date())]],
        tags: ["array", "date"],
    },
    { name: "array-nullable", properties: [["values", () => s.array(s.string()).nullable()]], tags: ["array", "nullable"] },
    { name: "array-optional", properties: [["values", () => s.array(s.string()).optional()]], tags: ["array", "optional"] },

    // --- Objects, depth 1 to 3 ---
    {
        name: "object-depth-1",
        properties: [["nested", () => s.object({ value: s.string() })]],
        tags: ["object"],
    },
    {
        name: "object-depth-2",
        properties: [["nested", () => s.object({ inner: s.object({ value: s.string() }) })]],
        tags: ["object"],
    },
    {
        name: "object-depth-3",
        properties: [["nested", () => s.object({ inner: s.object({ deepest: s.object({ value: s.string() }) }) })]],
        tags: ["object"],
    },
    {
        name: "object-mixed-scalars",
        properties: [[
            "nested",
            () => s.object({
                text: s.string(),
                count: s.number(),
                flag: s.boolean(),
                at: s.date(),
            }),
        ]],
        tags: ["object", "date"],
    },

    // --- Placement: nested under nullable / renamed parents ---
    {
        name: "object-nullable-parent",
        properties: [["nested", () => s.object({ value: s.string() }).nullable()]],
        tags: ["object", "nullable", "placement"],
    },
    {
        name: "object-optional-parent",
        properties: [["nested", () => s.object({ value: s.string() }).optional()]],
        tags: ["object", "optional", "placement"],
    },
    {
        name: "object-renamed-parent",
        properties: [["nested", () => s.object({ value: s.string() }).from("wire_nested")]],
        tags: ["object", "rename", "placement"],
    },
    {
        name: "nested-renamed-child",
        properties: [["nested", () => s.object({ value: s.string().from("wire_value") })]],
        tags: ["object", "rename", "placement"],
    },
    {
        name: "nested-nullable-child",
        properties: [["nested", () => s.object({ value: s.string().nullable() })]],
        tags: ["object", "nullable", "placement"],
    },
    {
        name: "nested-default-child",
        properties: [["nested", () => s.object({ value: s.string().default("nested-fallback") })]],
        tags: ["object", "default", "placement"],
    },
    {
        name: "nested-date-child",
        properties: [["nested", () => s.object({ at: s.date() })]],
        tags: ["object", "date", "placement"],
    },

    // --- Literal unions ---
    { name: "string-literals", properties: [["value", () => s.string("a", "b", "c")]], tags: ["literal"] },
    { name: "number-literals", properties: [["value", () => s.number(1, 2, 3)]], tags: ["literal"] },

    // --- Multi-property and wide shapes, where declaration order bites ---
    {
        name: "multi-scalar",
        properties: [
            ["text", () => s.string()],
            ["count", () => s.number()],
            ["flag", () => s.boolean()],
            ["at", () => s.date()],
        ],
        tags: ["multi", "date"],
    },
    {
        name: "multi-mixed-modifiers",
        properties: [
            ["text", () => s.string().nullable()],
            ["count", () => s.number().optional()],
            ["flag", () => s.boolean().default(false)],
            ["at", () => s.date().from("wire_at")],
            ["nested", () => s.object({ value: s.string() })],
            ["values", () => s.array(s.string())],
        ],
        tags: ["multi", "date", "rename", "default"],
    },
    {
        name: "multi-all-nullable",
        properties: [
            ["text", () => s.string().nullable()],
            ["count", () => s.number().nullable()],
            ["flag", () => s.boolean().nullable()],
            ["at", () => s.date().nullable()],
        ],
        tags: ["multi", "nullable", "date"],
    },
];

/**
 * Compiles every spec in every property order.
 *
 * Compilation happens once at module load and is cached: `compile()` generates and
 * evaluates source, so recompiling per test would dominate the runtime of a suite that
 * runs thousands of cases.
 */
let cachedCases: readonly ShapeCase[] | null = null;

export function shapeCatalog(): readonly ShapeCase[] {
    if (cachedCases != null) {
        return cachedCases;
    }

    const cases: ShapeCase[] = [];

    for (const spec of SHAPE_SPECS) {
        for (const order of PROPERTY_ORDERS) {
            const ordered = orderProperties(spec.properties, order);

            cases.push({
                spec,
                order,
                name: `${spec.name} [${order}]`,
                // Collection name includes the order: a schema id is hashed from property
                // names plus collection name, so sharing a name would alias two shapes.
                schema: s.define(`catalog_${spec.name}_${order}`, toDefinition(ordered)).compile(),
                propertyNames: ordered.map(([name]) => name),
            });
        }
    }

    cachedCases = cases;

    return cases;
}

/** Selects catalog cases whose spec carries every one of the given tags. */
export function shapesWithTags(...tags: string[]): readonly ShapeCase[] {
    return shapeCatalog().filter(c => tags.every(tag => (c.spec.tags ?? []).includes(tag)));
}
