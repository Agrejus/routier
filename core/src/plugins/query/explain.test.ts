import { describe, it, expect } from '@jest/globals';
import { s } from '../../schema';
import { toExpression } from '../../expressions';
import { QueryOptionsCollection } from './QueryOptionsCollection';
import { reportRenamedProperties } from './renames';
import { QueryOrdering } from './types';
import { explainQuery, withExecutedQueries, MEMORY_EXECUTION_EXPLANATIONS, withInnerSide } from './explain';
import { formatExplanation } from './formatExplanation';

const schema = s.define("players", {
    id: s.string().key(),
    name: s.string(),
    rank: s.number(),
    displayName: s.string().from("display_name")
}).modify((w) => ({
    fullName: w.computed((entity) => `${entity.name}!`)
})).compile();

const CONTEXT = { collection: "players", database: "test.db", pluginKind: "TestPlugin" };

const optionsWith = (build: (options: QueryOptionsCollection<any>) => void) => {
    const options = new QueryOptionsCollection<any>();
    build(options);
    return options;
};

const addFilter = (options: QueryOptionsCollection<any>, filter: (x: any) => boolean) => {
    options.add("filter", { filter, expression: toExpression(schema as never, filter), params: undefined } as never);
};

const nearestOn = (propertyName: string) => ({
    selector: (x: any) => x[propertyName],
    propertyName,
    property: schema.getProperty(propertyName),
    vector: [1, 2, 3],
    count: 10
});

/** Fields renamed in the projection keep `isRename` false, so core leaves the map with the database. */
const fieldOn = (propertyName: string) => ({
    sourceName: propertyName,
    destinationName: `${propertyName}Out`,
    isRename: false,
    property: schema.getProperty(propertyName)
});

const mapOf = (...propertyNames: string[]) => ({
    selector: (x: any) => Object.fromEntries(propertyNames.map(name => [`${name}Out`, x[name]])),
    fields: propertyNames.map(fieldOn)
});

const groupOn = (propertyName: string, fields: ReturnType<typeof fieldOn>[]) => ({
    selector: (x: any) => x[propertyName],
    key: fieldOn(propertyName),
    fields
});

const sortOn = (propertyName: string) => ({
    selector: (x: any) => x[propertyName],
    direction: QueryOrdering.Ascending,
    propertyName,
    property: schema.getProperty(propertyName)
});

describe('reason codes', () => {

    it('records `executed` when everything pushes down', () => {
        const options = optionsWith(o => {
            addFilter(o, (x: any) => x.rank > 10);
            o.add("take", 20);
        });

        const targets: string[] = [];
        options.forEach(option => targets.push(option.target));

        expect(targets).toEqual(["database", "database"]);
        options.forEach(option => expect(option.reason).toBe("executed"));
    });

    /** The plugin decides whether it can read a `from` name — see `reportRenamedProperties`. */
    it('keeps a filter on a `from` property with the database', () => {
        const options = optionsWith(o => addFilter(o, (x: any) => x.displayName === "ada"));

        options.forEach(option => {
            expect(option.target).toBe("database");
            expect(option.reason).toBe("executed");
        });
    });

    it('records unmapped-property for a filter on a computed property', () => {
        const options = optionsWith(o => addFilter(o, (x: any) => x.fullName === "ada!"));

        options.forEach(option => {
            expect(option.target).toBe("memory");
            expect(option.reason).toBe("unmapped-property");
        });
    });

    it('keeps a sort and a window on a `from` property with the database', () => {
        const options = optionsWith(o => {
            o.add("sort", sortOn("displayName") as never);
            o.add("take", 20);
        });

        options.forEach(option => {
            expect(option.target).toBe("database");
            expect(option.reason).toBe("executed");
        });
    });

    it('keeps a similarity search on a `from` property with the database', () => {
        const options = optionsWith(o => o.add("nearest", nearestOn("displayName") as never));

        options.forEach(option => {
            expect(option.target).toBe("database");
            expect(option.reason).toBe("executed");
        });
    });

    it('still records unmapped-property for a sort on a computed property', () => {
        const options = optionsWith(o => o.add("sort", sortOn("fullName") as never));

        options.forEach(option => {
            expect(option.target).toBe("memory");
            expect(option.reason).toBe("unmapped-property");
        });
    });

    it('ratchets everything after a join to after-join', () => {
        const options = optionsWith(o => {
            addFilter(o, (x: any) => x.rank > 10);
            o.add("join", {
                kind: "inner",
                innerSchemaId: 1,
                outerKey: { propertyName: "id", property: null },
                innerKey: { propertyName: "playerId", property: null },
                innerOptions: new QueryOptionsCollection<any>(),
                crossPlugin: false,
                semiJoinKeyThreshold: 500
            } as never);
            o.add("take", 20);
        });

        const recorded: { name: string, target: string, reason?: string }[] = [];
        options.forEach(o => recorded.push({ name: o.name, target: o.target, reason: o.reason }));

        expect(recorded).toEqual([
            { name: "filter", target: "database", reason: "executed" },
            { name: "join", target: "database", reason: "executed" },
            { name: "take", target: "memory", reason: "after-join" }
        ]);
    });

    it('keeps the FIRST cause when several would apply', () => {
        const options = optionsWith(o => {
            addFilter(o, (x: any) => x.fullName === "ada!");
            o.add("map", {
                selector: (x: any) => ({ n: x.name }),
                fields: [{ sourceName: "name", destinationName: "n", isRename: true }]
            } as never);
        });

        options.forEach(option => expect(option.reason).toBe("unmapped-property"));
    });

    it('records map-rename when a map renames a property', () => {
        const options = optionsWith(o => {
            o.add("map", {
                selector: (x: any) => ({ n: x.name }),
                fields: [{ sourceName: "name", destinationName: "n", isRename: true }]
            } as never);
            o.add("take", 5);
        });

        options.forEach(option => {
            expect(option.target).toBe("memory");
            expect(option.reason).toBe("map-rename");
        });
    });

    it('records not-parsable for a filter the parser cannot read', () => {
        const options = new QueryOptionsCollection<any>();

        options.add("filter", {
            filter: () => true,
            params: undefined,
            expression: { type: "not-parsable" }
        } as never);

        options.forEach(option => {
            expect(option.target).toBe("memory");
            expect(option.reason).toBe("not-parsable");
        });
    });

    it('keeps nearest itself in the database and ratchets what follows', () => {
        const options = optionsWith(o => {
            o.add("nearest", {
                selector: (x: any) => x.rank,
                propertyName: "rank",
                property: schema.getProperty("rank"),
                vector: [1, 2, 3],
                count: 10
            } as never);
            o.add("take", 3);
        });

        const recorded: { name: string, target: string, reason?: string }[] = [];
        options.forEach(o => recorded.push({ name: o.name, target: o.target, reason: o.reason }));

        expect(recorded).toEqual([
            { name: "nearest", target: "database", reason: "executed" },
            { name: "take", target: "memory", reason: "after-nearest" }
        ]);
    });

    it('records cross-plugin-join on the join option itself', () => {
        const options = optionsWith(o => o.add("join", {
            kind: "inner",
            innerSchemaId: 1,
            outerKey: { propertyName: "id", property: null },
            innerKey: { propertyName: "playerId", property: null },
            innerOptions: new QueryOptionsCollection<any>(),
            crossPlugin: true,
            semiJoinKeyThreshold: 500
        } as never));

        options.forEach(option => {
            expect(option.target).toBe("memory");
            expect(option.reason).toBe("cross-plugin-join");
        });
    });

    /**
     * Staleness used to be `enumeratedItems.length !== nextIndex`, which made an empty list rebuild
     * itself, so restore only had to clear it. With a flag, clearing without setting the flag leaves
     * every later read seeing NO options — a second terminal on the same queryable dispatched with
     * an empty collection and returned the whole table.
     */
    it('enumerates again after a restore that follows a read', () => {
        const options = optionsWith(o => o.add("take", 1));

        options.forEach(() => undefined);

        const restore = options.snapshot();

        options.add("skip", 5);
        options.forEach(() => undefined);
        restore();

        const names: string[] = [];
        options.forEach(option => names.push(option.name));

        expect(names).toEqual(["take"]);
    });

    it('restores a database option through a snapshot', () => {
        // The snapshot has to be taken BEFORE the cut over, or restoring cannot undo anything.
        const options = optionsWith(o => o.add("take", 1));
        const restore = options.snapshot();

        addFilter(options, (x: any) => x.displayName === "ada");
        restore();
        options.add("skip", 5);

        const recorded: { name: string, target: string, reason?: string }[] = [];
        options.forEach(o => recorded.push({ name: o.name, target: o.target, reason: o.reason }));

        expect(recorded).toEqual([
            { name: "take", target: "database", reason: "executed" },
            { name: "skip", target: "database", reason: "executed" }
        ]);
    });

    it('has an explanation sentence for every reason code', () => {
        const codes = [
            "not-parsable", "unmapped-property", "map-rename",
            "after-nearest", "after-join", "cross-plugin-join"
        ] as const;

        for (const code of codes) {
            expect(typeof MEMORY_EXECUTION_EXPLANATIONS[code]).toBe("string");
            expect(MEMORY_EXECUTION_EXPLANATIONS[code].length).toBeGreaterThan(0);
        }
    });
});

describe('reportRenamedProperties', () => {

    const recordOf = (options: QueryOptionsCollection<any>) => {
        const recorded: { name: string, target: string, reason?: string }[] = [];
        options.forEach(o => recorded.push({ name: o.name, target: o.target, reason: o.reason }));
        return recorded;
    };

    it('hands back a filter on a `from` property, and the rest of the database phase with it', () => {
        const options = optionsWith(o => {
            addFilter(o, (x: any) => x.rank > 10);
            addFilter(o, (x: any) => x.displayName === "ada");
            o.add("take", 20);
        });

        reportRenamedProperties(options);

        expect(recordOf(options)).toEqual([
            { name: "filter", target: "database", reason: "executed" },
            { name: "filter", target: "database", reason: "missing-capability" },
            { name: "take", target: "database", reason: "not-reached" }
        ]);
    });

    it('hands back a sort and a similarity search on a `from` property', () => {
        const sorted = optionsWith(o => o.add("sort", sortOn("displayName") as never));
        const searched = optionsWith(o => o.add("nearest", nearestOn("displayName") as never));

        reportRenamedProperties(sorted);
        reportRenamedProperties(searched);

        expect(recordOf(sorted)).toEqual([{ name: "sort", target: "database", reason: "missing-capability" }]);
        expect(recordOf(searched)).toEqual([{ name: "nearest", target: "database", reason: "missing-capability" }]);
    });

    it('checks only the options it is asked to', () => {
        const options = optionsWith(o => {
            o.add("sort", sortOn("displayName") as never);
            o.add("nearest", nearestOn("displayName") as never);
        });

        reportRenamedProperties(options, ["nearest"]);

        expect(recordOf(options)).toEqual([
            { name: "sort", target: "database", reason: "executed" },
            { name: "nearest", target: "database", reason: "missing-capability" }
        ]);
    });

    it('finds a renamed segment anywhere in a nested path', () => {
        const nested = s.define("nested", {
            id: s.string().key(),
            payload: s.object({ value: s.string() }).from("wire_payload")
        }).compile();

        const filter = (x: any) => x.payload.value === "a";
        const options = optionsWith(o => o.add("filter", { filter, expression: toExpression(nested as never, filter), params: undefined } as never));

        reportRenamedProperties(options);

        expect(recordOf(options)).toEqual([{ name: "filter", target: "database", reason: "missing-capability" }]);
    });

    it('hands back a map that selects a `from` property, and the aggregate reading it', () => {
        const options = optionsWith(o => {
            o.add("map", mapOf("displayName") as never);
            o.add("max", true);
        });

        reportRenamedProperties(options);

        expect(recordOf(options)).toEqual([
            { name: "map", target: "database", reason: "missing-capability" },
            { name: "max", target: "database", reason: "not-reached" }
        ]);
    });

    it('hands back a map with one `from` field among others', () => {
        const options = optionsWith(o => o.add("map", mapOf("name", "displayName") as never));

        reportRenamedProperties(options);

        expect(recordOf(options)).toEqual([{ name: "map", target: "database", reason: "missing-capability" }]);
    });

    it('hands back a group keyed on a `from` property, or copying one into its members', () => {
        const keyed = optionsWith(o => o.add("group", groupOn("displayName", mapOf("name").fields) as never));
        const copying = optionsWith(o => o.add("group", groupOn("name", mapOf("name", "displayName").fields) as never));

        reportRenamedProperties(keyed);
        reportRenamedProperties(copying);

        expect(recordOf(keyed)).toEqual([{ name: "group", target: "database", reason: "missing-capability" }]);
        expect(recordOf(copying)).toEqual([{ name: "group", target: "database", reason: "missing-capability" }]);
    });

    it('leaves options with no renamed property alone', () => {
        const options = optionsWith(o => {
            addFilter(o, (x: any) => x.rank > 10);
            o.add("sort", sortOn("name") as never);
            o.add("map", mapOf("name", "rank") as never);
            o.add("group", groupOn("name", mapOf("name", "rank").fields) as never);
        });

        reportRenamedProperties(options);

        expect(options.notExecuted()).toEqual([]);
    });

    it('reads as missing-capability in an explanation', () => {
        const options = optionsWith(o => addFilter(o, (x: any) => x.displayName === "ada"));

        reportRenamedProperties(options);

        expect(explainQuery(options, CONTEXT).summary.reasons).toEqual(["missing-capability"]);
    });
});

describe('explainQuery', () => {

    it('reports one database step when everything pushes down', () => {
        const options = optionsWith(o => {
            addFilter(o, (x: any) => x.rank > 10);
            o.add("take", 20);
        });

        const explanation = explainQuery(options, CONTEXT);

        expect(explanation.collection).toBe("players");
        expect(explanation.database).toBe("test.db");
        expect(explanation.plugin.kind).toBe("TestPlugin");
        expect(explanation.executionSteps).toHaveLength(1);
        expect(explanation.executionSteps[0].executedIn).toEqual({ kind: "database", database: "test.db", plugin: "TestPlugin" });
        expect(explanation.executionSteps[0].step).toBe(1);
        expect(explanation.executionSteps[0].of).toBe(1);
        expect(explanation.summary).toMatchObject({ database: 2, memory: 0, reasons: [] });
    });

    it('groups consecutive options into steps and numbers them', () => {
        const options = optionsWith(o => {
            addFilter(o, (x: any) => x.rank > 10);
            o.add("join", {
                kind: "inner",
                innerSchemaId: 1,
                outerKey: { propertyName: "id", property: null },
                innerKey: { propertyName: "playerId", property: null },
                innerOptions: new QueryOptionsCollection<any>(),
                crossPlugin: false,
                semiJoinKeyThreshold: 500
            } as never);
            o.add("skip", 40);
            o.add("take", 20);
        });

        const { executionSteps, summary } = explainQuery(options, CONTEXT);

        expect(executionSteps).toHaveLength(2);
        expect(executionSteps[0]).toMatchObject({ step: 1, of: 2, executedIn: { kind: "database", database: "test.db", plugin: "TestPlugin" } });
        expect(executionSteps[0].options.map(x => x.name)).toEqual(["filter", "join"]);
        expect(executionSteps[1]).toMatchObject({ step: 2, of: 2, executedIn: { kind: "memory" }, reason: "after-join" });
        expect(executionSteps[1].options.map(x => x.name)).toEqual(["skip", "take"]);
        expect((executionSteps[1] as { explanation?: string }).explanation).toBe(MEMORY_EXECUTION_EXPLANATIONS["after-join"]);
        expect(summary).toMatchObject({ database: 2, memory: 2, reasons: ["after-join"] });
    });

    it('dedupes reasons in the summary', () => {
        const options = optionsWith(o => {
            addFilter(o, (x: any) => x.fullName === "ada!");
            o.add("skip", 1);
            o.add("take", 2);
        });

        const { summary } = explainQuery(options, CONTEXT);

        expect(summary.reasons).toEqual(["unmapped-property"]);
        expect(summary.memory).toBe(3);
        expect(summary.explanation).toContain(MEMORY_EXECUTION_EXPLANATIONS["unmapped-property"]);
    });

    it('serializes a filter expression into the option detail', () => {
        const options = optionsWith(o => addFilter(o, (x: any) => x.rank > 10));
        const { executionSteps } = explainQuery(options, CONTEXT);

        expect(executionSteps[0].options[0].detail?.expression).toMatchObject({
            type: "comparator",
            comparator: "greater-than"
        });
    });

    it('reports a value it cannot serialize instead of throwing', () => {
        const options = new QueryOptionsCollection<any>();

        options.add("filter", {
            filter: () => true,
            params: undefined,
            expression: {
                type: "comparator",
                comparator: "equals",
                negated: false,
                strict: true,
                left: { type: "value", value: () => 1, transformer: null, locale: null },
                right: { type: "value", value: 1, transformer: null, locale: null }
            }
        } as never);

        const { executionSteps } = explainQuery(options, CONTEXT);

        expect(executionSteps[0].options[0].detail).toHaveProperty("expressionUnavailable");
    });

    it('still reports a database step when NOTHING pushed down', () => {
        // The plugin is dispatched either way, so it reads the whole collection. Reporting only
        // the memory step would hide the table scan this feature exists to expose.
        const options = optionsWith(o => addFilter(o, (x: any) => x.fullName === "ada!"));
        const { executionSteps, summary } = explainQuery(options, CONTEXT);

        expect(executionSteps).toHaveLength(2);
        expect(executionSteps[0]).toMatchObject({ step: 1, of: 2, executedIn: { kind: "database", database: "test.db", plugin: "TestPlugin" }, options: [] });
        expect(executionSteps[1]).toMatchObject({ step: 2, of: 2, executedIn: { kind: "memory" } });
        expect(summary).toMatchObject({ database: 0, memory: 1 });
    });

    it('reports the unnarrowed read for a query with no options at all', () => {
        const explanation = explainQuery(new QueryOptionsCollection<any>(), CONTEXT);

        expect(explanation.executionSteps).toHaveLength(1);
        expect(explanation.executionSteps[0]).toMatchObject({ step: 1, of: 1, executedIn: { kind: "database", database: "test.db", plugin: "TestPlugin" } });
        expect(explanation.summary).toMatchObject({ database: 0, memory: 0, reasons: [] });
    });

    /**
     * `split()` used to rebuild each half by re-adding, which re-ran the cascade: the post-join
     * `take`, alone in the memory half, came back out as `database` with no reason. It adopts the
     * items now, so a half is as good to explain as the whole.
     */
    it(`keeps each half's targets when split, so a half can be explained`, () => {
        const options = optionsWith(o => {
            addFilter(o, (x: any) => x.rank > 10);
            o.add("join", {
                kind: "inner",
                innerSchemaId: 1,
                outerKey: { propertyName: "id", property: null },
                innerKey: { propertyName: "playerId", property: null },
                innerOptions: new QueryOptionsCollection<any>(),
                crossPlugin: false,
                semiJoinKeyThreshold: 500
            } as never);
            o.add("take", 20);
        });

        const { memory, database } = options.split();

        memory.forEach(option => expect(option.target).toBe("memory"));
        database.forEach(option => expect(option.target).toBe("database"));
        // A synthetic empty database step is always prepended — the plugin is dispatched either
        // way — so the memory work is the step after it, carrying the reason that put it there.
        const steps = explainQuery(memory, CONTEXT).executionSteps;

        expect(steps.filter(step => step.executedIn.kind === "memory").map(step => (step as { reason?: string }).reason)).toEqual(["after-join"]);
    });

    it('keeps targets through splitAt too', () => {
        const options = optionsWith(o => addFilter(o, (x: any) => x.rank > 10));

        expect(explainQuery(options.splitAt("filter").before, CONTEXT)).toBeDefined();
    });
});

describe('withExecutedQueries', () => {

    const twoStep = () => explainQuery(optionsWith(o => {
        addFilter(o, (x: any) => x.rank > 10);
        o.add("join", {
            kind: "inner",
            innerSchemaId: 1,
            outerKey: { propertyName: "id", property: null },
            innerKey: { propertyName: "playerId", property: null },
            innerOptions: new QueryOptionsCollection<any>(),
            crossPlugin: false,
            semiJoinKeyThreshold: 500
        } as never);
        o.add("take", 20);
    }), CONTEXT);

    it('attaches the statements to the database step', () => {
        const merged = withExecutedQueries(twoStep(), [
            { text: "SELECT * FROM players WHERE rank > ?", parameters: [10] },
            { text: "SELECT * FROM playerMatches WHERE playerId IN (?)", parameters: ["a"] }
        ]);

        expect((merged.executionSteps[0] as { executedQueries: unknown[] }).executedQueries).toHaveLength(2);
        expect((merged.executionSteps[0] as { executedQueries: { parameters?: unknown[] }[] }).executedQueries[0].parameters).toEqual([10]);
        expect((merged.executionSteps[1] as { executedQueries?: unknown[] }).executedQueries).toBeUndefined();
    });

    it('does not mutate the explanation it was given', () => {
        const original = twoStep();

        withExecutedQueries(original, [{ text: "SELECT 1" }]);

        expect((original.executionSteps[0] as { executedQueries: unknown[] }).executedQueries).toEqual([]);
    });

    it('marks the database step as not reported when the plugin reported nothing', () => {
        const marked = withExecutedQueries(twoStep(), []);

        const [databaseStep, memoryStep] = marked.executionSteps as { executedQueries?: unknown[], executedQueriesUnsupported?: string }[];

        expect(databaseStep.executedQueries).toEqual([]);
        expect(databaseStep.executedQueriesUnsupported).toMatch(/did not report/);
        expect(memoryStep.executedQueriesUnsupported).toBeUndefined();
    });

    it('does not mark any step once the plugin reported', () => {
        const merged = withExecutedQueries(twoStep(), [{ text: "SELECT 1" }]);

        merged.executionSteps.forEach(step => expect((step as { executedQueriesUnsupported?: string }).executedQueriesUnsupported).toBeUndefined());
    });

    it('stamps only the first database step', () => {
        const merged = withExecutedQueries(twoStep(), [{ text: "SELECT 1" }]);
        const stamped = merged.executionSteps.filter(step => ((step as { executedQueries?: unknown[] }).executedQueries?.length ?? 0) > 0);

        expect(stamped).toHaveLength(1);
    });
});

describe('formatExplanation', () => {

    it('labels each step and prints the statements', () => {
        const explanation = withExecutedQueries(explainQuery(optionsWith(o => {
            addFilter(o, (x: any) => x.rank > 10);
            o.add("join", {
                kind: "inner",
                innerSchemaId: 1,
                outerKey: { propertyName: "id", property: null },
                innerKey: { propertyName: "playerId", property: null },
                innerOptions: new QueryOptionsCollection<any>(),
                crossPlugin: false,
                semiJoinKeyThreshold: 500
            } as never);
            o.add("take", 20);
        }), CONTEXT), [{ text: "SELECT * FROM players WHERE rank > ?", parameters: [10] }]);

        const output = formatExplanation(explanation);

        expect(output).toContain("players · test.db · 2 steps");
        expect(output).toContain("STEP 1 of 2 — database");
        expect(output).toContain("STEP 2 of 2 — memory  [after-join]");
        expect(output).toContain("SELECT * FROM players WHERE rank > ?");
        expect(output).toContain("parameters: [10]");
        expect(output).toContain("2 options ran in the database, 1 ran in memory.");
    });

    it('renders the predicate so a reader can see WHICH where pushed down', () => {
        const options = optionsWith(o => addFilter(o, (x: any) => x.rank > 10 && x.name === "ada"));
        const output = formatExplanation(explainQuery(options, CONTEXT));

        expect(output).toContain("rank > 10");
        expect(output).toContain('name === "ada"');
    });

    it('names the collection read when nothing pushed down', () => {
        const options = optionsWith(o => addFilter(o, (x: any) => x.fullName === "ada!"));
        const output = formatExplanation(explainQuery(options, CONTEXT));

        expect(output).toContain("STEP 1 of 2 — database");
        expect(output).toContain("No option could be pushed down");
        expect(output).toContain("[unmapped-property]");
    });
});

describe('withInnerSide', () => {

    const outerOnly = () => explainQuery(optionsWith(o => addFilter(o, (x: any) => x.rank > 10)), CONTEXT);

    /**
     * A cross-plugin join reads two databases, and until this existed the second one's statement was
     * filed under the first one's plugin — a PouchDB scan reported as having run in SQLite.
     */
    it('reports the inner side as its own step, naming its database and plugin', () => {
        const explained = withInnerSide(withExecutedQueries(outerOnly(), [{ text: "SELECT * FROM players" }]), {
            database: "crm",
            plugin: "PouchDbPlugin",
            executedQueries: [{ text: "allDocs({ include_docs: true })" }]
        });

        expect(explained.executionSteps.map(step => step.executedIn)).toEqual([
            { kind: "database", database: "test.db", plugin: "TestPlugin" },
            { kind: "database", database: "crm", plugin: "PouchDbPlugin" }
        ]);
    });

    it(`keeps each plugin's statements on its own step`, () => {
        const explained = withInnerSide(withExecutedQueries(outerOnly(), [{ text: "SELECT * FROM players" }]), {
            database: "crm",
            plugin: "PouchDbPlugin",
            executedQueries: [{ text: "allDocs({ include_docs: true })" }]
        });

        const steps = explained.executionSteps as { executedQueries: { text: string }[] }[];

        expect(steps[0].executedQueries.map(q => q.text)).toEqual(["SELECT * FROM players"]);
        expect(steps[1].executedQueries.map(q => q.text)).toEqual(["allDocs({ include_docs: true })"]);
    });

    it('renumbers, so the reader sees how many steps there really are', () => {
        const explained = withInnerSide(outerOnly(), { database: "crm", plugin: "PouchDbPlugin", executedQueries: [{ text: "allDocs()" }] });

        expect(explained.executionSteps.map(step => `${step.step} of ${step.of}`)).toEqual(["1 of 2", "2 of 2"]);
    });

    // The join cannot run until both sides are read, so the inner read belongs in front of the
    // memory work that consumes it
    it('puts the inner read before the memory steps', () => {
        const withJoin = explainQuery(optionsWith(o => {
            addFilter(o, (x: any) => x.rank > 10);
            o.add("join", { kind: "inner", innerSchemaId: 1, outerKey: { propertyName: "id", property: null }, innerKey: { propertyName: "playerId", property: null }, innerOptions: new QueryOptionsCollection<any>(), crossPlugin: true, semiJoinKeyThreshold: 500 } as never);
        }), CONTEXT);

        const explained = withInnerSide(withJoin, { database: "crm", plugin: "PouchDbPlugin", executedQueries: [{ text: "allDocs()" }] });
        const kinds = explained.executionSteps.map(step => step.executedIn.kind);

        expect(kinds.indexOf("memory")).toBeGreaterThan(kinds.lastIndexOf("database"));
    });
});
