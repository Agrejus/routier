import { expect } from '@jest/globals';
import { MemoryTrace } from './memory';
import { Oracle, compareToOracle, describeComparison } from './oracle';
import { Rng } from './rng';

/**
 * The two reusable loads: volume and churn.
 *
 * S1 and S3 defined these inline, which was right while each ran against one backend list.
 * S8 breaks that: the spec asks for "S1 scaled to 10k and S3 scaled to 2k cycles against
 * Postgres", and a second hand-written copy of a load is a copy that drifts. When it drifts
 * the two scenarios stop hunting the same defect, and the one that still passes tells you
 * nothing about the one that does not.
 *
 * So the load lives here, parameterised by scale and by shape, and S1, S3, and S8 all call
 * it. What stays in each scenario file is what is genuinely local: which schema, which
 * backends, which budget, and the prose explaining what that combination hunts.
 *
 * These functions assert. They are given `expect` rather than returning a report because a
 * failure needs to name the batch or cycle it happened on, and that context is gone by the
 * time a return value reaches the caller. `note` carries the same context into the
 * scenario's failure banner.
 */

/**
 * The minimum a workload needs from a store. Deliberately structural rather than
 * `DataStore`: the collections these run against are typed per schema, and S8's Postgres
 * store shares no base class with `TestDataStore`.
 */
export type WorkloadStore = {
    saveChangesAsync(): Promise<{ aggregate: { adds: number; updates: number; removes: number; size: number } }>;
    hasChangesAsync(): Promise<boolean>;
    previewChangesAsync(): Promise<{ aggregate: { adds: number; updates: number; removes: number; size: number } }>;
};

export type WorkloadCollection = {
    addAsync(...entities: any[]): Promise<any[]>;
    removeAsync(...entities: any[]): Promise<any>;
    toArrayAsync(): Promise<any[]>;
    countAsync(): Promise<number>;
};

// ---------------------------------------------------------------------------
// Volume (S1)
// ---------------------------------------------------------------------------

export type VolumePlan = {
    readonly adds: number;
    readonly addBatchSize: number;
    readonly mixedBatches: number;
    /** Per mixed batch, of each kind. Updates and removes each total adds/10. */
    readonly updatesPerBatch: number;
    readonly removesPerBatch: number;
    readonly addsPerBatch: number;
};

/**
 * Scales the whole load off one number, so a backend's budget (see backends.ts) sets every
 * phase consistently. The spec's shape at the memory budget of 100k: 1k-entity add batches,
 * then 10k updates and 10k removals spread over mixed batches.
 */
export const volumePlanFor = (budget: number): VolumePlan => ({
    adds: budget,
    addBatchSize: Math.max(1, Math.round(budget / 100)),
    mixedBatches: 20,
    updatesPerBatch: Math.max(1, Math.round(budget / 10 / 20)),
    removesPerBatch: Math.max(1, Math.round(budget / 10 / 20)),
    addsPerBatch: Math.max(1, Math.round(budget / 20 / 20)),
});

/** Every scale knob of a volume run, for `stressIt`'s scale banner. */
export const volumeScale = (backendName: string, plan: VolumePlan) => ({
    backend: backendName,
    entities: plan.adds,
    addBatchSize: plan.addBatchSize,
    mixedBatches: plan.mixedBatches,
    updatesPerBatch: plan.updatesPerBatch,
    removesPerBatch: plan.removesPerBatch,
    addsPerBatch: plan.addsPerBatch,
});

export type VolumeWorkload<T extends Record<string, any>> = {
    readonly store: WorkloadStore;
    readonly collection: WorkloadCollection;
    readonly plan: VolumePlan;
    readonly rng: Rng;
    readonly note: (message: string) => void;
    /** A fresh, unsaved entity. Content should be deterministic so a divergence names a row. */
    newEntity(): any;
    keyOf(entity: T): string;
    /** A plain copy, detached from whatever proxy the store handed back. */
    snapshot(entity: T): T;
    /** Fields compared against the oracle at the end. */
    readonly fields: readonly (keyof T)[];
    /** Applies the batch's update to an entity. */
    mutate(entity: T, batch: number): void;
};

/**
 * Volume through one store and one collection: `plan.adds` entities in batches, then mixed
 * batches carrying adds, updates, and removes in a single save.
 *
 * Every assertion here stays scalar. A failed `toHaveLength` prints the whole received
 * value, and pretty-formatting a hundred thousand change-tracked proxies takes longer than
 * the scenario it was reporting on — the failure looks like a hang. Collection-level
 * divergence goes through `compareToOracle`, which reports a bounded sample.
 */
export async function runVolumeWorkload<T extends Record<string, any>>(
    workload: VolumeWorkload<T>
): Promise<void> {
    const { store, collection, plan, rng, note, keyOf, snapshot } = workload;
    const oracle = new Oracle<T>(keyOf);

    // ---- Phase 1: adds ----------------------------------------------------
    for (let batch = 0; batch * plan.addBatchSize < plan.adds; batch++) {
        const size = Math.min(plan.addBatchSize, plan.adds - batch * plan.addBatchSize);

        const added = await collection.addAsync(
            ...Array.from({ length: size }, () => workload.newEntity())
        );
        const result = await store.saveChangesAsync();

        expect(result.aggregate.adds).toBe(size);
        expect(result.aggregate.updates).toBe(0);
        expect(result.aggregate.removes).toBe(0);

        // Ids are assigned by the store, so the oracle can only learn them after the save
        // that generated them.
        added.forEach(entity => oracle.set(snapshot(entity as T)));

        const count = await collection.countAsync();

        if (count !== oracle.size) {
            note(`diverged at add batch ${batch} (${(batch + 1) * plan.addBatchSize} entities in)`);
        }

        expect(count).toBe(oracle.size);
    }

    // A collision anywhere in phase 1 shows up as an oracle smaller than the number of
    // entities added — the Map overwrote the earlier row.
    expect(oracle.size).toBe(plan.adds);

    // ---- Phase 2: mixed batches ------------------------------------------
    // One read attaches every entity to the change tracker; mutations then run against
    // those proxies. Re-querying per batch would make this a query benchmark instead of a
    // persistence one, and at this volume it would not finish.
    const tracked = (await collection.toArrayAsync()) as T[];

    expect(tracked.length).toBe(oracle.size);

    const live = new Map(tracked.map(entity => [keyOf(entity), entity]));

    for (let batch = 0; batch < plan.mixedBatches; batch++) {
        const available = [...live.values()];
        const targets = rng.sample(available, plan.updatesPerBatch + plan.removesPerBatch);
        const toUpdate = targets.slice(0, plan.updatesPerBatch);
        const toRemove = targets.slice(plan.updatesPerBatch);

        for (const entity of toUpdate) {
            workload.mutate(entity, batch);
        }

        await collection.removeAsync(...toRemove);

        const added = await collection.addAsync(
            ...Array.from({ length: plan.addsPerBatch }, () => workload.newEntity())
        );

        const result = await store.saveChangesAsync();

        // The whole hunt in one place: three kinds of change in one save, each counted
        // separately, none allowed to absorb another.
        expect({
            adds: result.aggregate.adds,
            updates: result.aggregate.updates,
            removes: result.aggregate.removes,
        }).toEqual({
            adds: plan.addsPerBatch,
            updates: toUpdate.length,
            removes: toRemove.length,
        });

        toUpdate.forEach(entity => oracle.set(snapshot(entity)));
        toRemove.forEach(entity => {
            oracle.delete(keyOf(entity));
            live.delete(keyOf(entity));
        });
        added.forEach(entity => {
            oracle.set(snapshot(entity as T));
            live.set(keyOf(entity as T), entity as T);
        });

        const count = await collection.countAsync();

        if (count !== oracle.size) {
            note(`diverged at mixed batch ${batch}`);
        }

        expect(count).toBe(oracle.size);
    }

    // ---- Final: full read versus the oracle -------------------------------
    const final = (await collection.toArrayAsync()) as T[];
    const comparison = compareToOracle(oracle, final, keyOf, { fields: workload.fields });

    note(describeComparison(comparison));

    expect(describeComparison(comparison)).toBe('oracle matches');
}

// ---------------------------------------------------------------------------
// Churn (S3)
// ---------------------------------------------------------------------------

export type ChurnPlan = {
    readonly entities: number;
    readonly cycles: number;
    /** Entities mutated per cycle. */
    readonly subset: number;
    /** Cycles between full oracle reconciliations. */
    readonly reconcileEvery: number;
    /** Cycles between RSS samples. */
    readonly sampleEvery: number;
    /**
     * Cycles between full `previewChangesAsync` calls.
     *
     * The spec asks for one after every save. `previewChanges` runs the entire prepare
     * pipeline over every attachment, so ten thousand of them would dominate the runtime and
     * push the file past its 5-minute budget. Instead the cheap form of the same invariant —
     * `hasChangesAsync`, which short-circuits on the first dirty entity — runs after EVERY
     * save, and the full preview runs periodically to confirm the cheap check is not lying.
     * A tracker that fails to clean up fails the cheap check on cycle 2, so nothing is lost
     * by sampling the expensive one.
     */
    readonly previewEvery: number;
    /**
     * Whether to assert the RSS growth-rate bound.
     *
     * Only meaningful when the entity set is held in this process. Against a real server the
     * interesting memory lives in the server, and a 2k-cycle run gives the regression too
     * few samples to fit anyway — asserting it there would produce a verdict with no
     * evidence behind it.
     */
    readonly trackMemory: boolean;
};

export const churnScale = (backendName: string, plan: ChurnPlan) => ({
    backend: backendName,
    entities: plan.entities,
    cycles: plan.cycles,
    subsetPerCycle: plan.subset,
    reconcileEvery: plan.reconcileEvery,
    rssSampleEvery: plan.sampleEvery,
});

export type ChurnWorkload<T extends Record<string, any>> = {
    readonly store: WorkloadStore;
    readonly collection: WorkloadCollection;
    readonly plan: ChurnPlan;
    readonly rng: Rng;
    readonly note: (message: string) => void;
    /** The i'th seed entity. */
    seedEntity(index: number): any;
    keyOf(entity: T): string;
    snapshot(entity: T): T;
    readonly fields: readonly (keyof T)[];
    /** Applies this generation's mutation to an entity. */
    mutate(entity: T, generation: number): void;
    /**
     * A replacement for an entity that was just removed, reusing its key.
     *
     * Omit to skip the remove-and-re-add step. Supplying it is what makes the attachment map
     * see entities leave and come back rather than only being mutated in place.
     */
    readdEntity?(removed: T, generation: number): any;
};

/**
 * A small entity set, churned `plan.cycles` times.
 *
 * Volume finds what breaks when a structure gets big; churn finds what never gets released —
 * state that accumulates a little on every cycle and is invisible until the ten-thousandth.
 */
export async function runChurnWorkload<T extends Record<string, any>>(
    workload: ChurnWorkload<T>
): Promise<void> {
    const { store, collection, plan, rng, note, keyOf, snapshot } = workload;

    const oracle = new Oracle<T>(keyOf);
    const trace = new MemoryTrace();

    let generation = 0;

    await collection.addAsync(
        ...Array.from({ length: plan.entities }, (_, i) => workload.seedEntity(i))
    );
    await store.saveChangesAsync();

    ((await collection.toArrayAsync()) as T[]).forEach(entity => oracle.set(snapshot(entity)));

    expect(oracle.size).toBe(plan.entities);

    /** Reconciles the database against the oracle, failing with a bounded report. */
    const reconcile = async (cycle: number) => {
        const actual = (await collection.toArrayAsync()) as T[];
        const comparison = compareToOracle(oracle, actual, keyOf, { fields: workload.fields });

        if (comparison.matches === false) {
            note(`first divergence observed at cycle ${cycle}`);
            note(describeComparison(comparison));
        }

        expect(comparison.matches ? 'oracle matches' : describeComparison(comparison))
            .toBe('oracle matches');
    };

    for (let cycle = 0; cycle < plan.cycles; cycle++) {
        // Re-querying every cycle rather than holding one array is deliberate: the read path
        // re-resolves attachments, and a tracker that grows an entry per resolve instead of
        // reusing the canonical one only shows up under repeated reads.
        const page = (await collection.toArrayAsync()) as T[];
        const targets = rng.sample(page, plan.subset);

        generation++;

        for (const entity of targets) {
            workload.mutate(entity, generation);
        }

        const recycled = workload.readdEntity != null && rng.chance(0.05)
            ? rng.sample(targets, 1)[0]
            : null;

        if (recycled != null) {
            await collection.removeAsync(recycled);
        }

        await store.saveChangesAsync();

        targets.forEach(entity => oracle.set(snapshot(entity)));

        if (recycled != null) {
            oracle.delete(keyOf(recycled));

            const [readded] = await collection.addAsync(
                workload.readdEntity!(recycled, generation)
            );
            await store.saveChangesAsync();
            oracle.set(snapshot(readded as T));
        }

        // The cheap form of "no pending changes after a save", run every cycle.
        const stillDirty = await store.hasChangesAsync();

        if (stillDirty) {
            note(`store still reported changes immediately after the save in cycle ${cycle}`);
        }

        expect(stillDirty).toBe(false);

        if (cycle % plan.previewEvery === 0) {
            const pending = await store.previewChangesAsync();

            if (pending.aggregate.size !== 0) {
                note(
                    `cycle ${cycle}: previewChanges reported ${pending.aggregate.size} pending ` +
                    `(adds ${pending.aggregate.adds}, updates ${pending.aggregate.updates}, removes ${pending.aggregate.removes})`
                );
            }

            expect(pending.aggregate.size).toBe(0);
        }

        if (plan.trackMemory && cycle % plan.sampleEvery === 0) {
            trace.sample(cycle);
        }

        if (cycle > 0 && cycle % plan.reconcileEvery === 0) {
            await reconcile(cycle);
        }
    }

    await reconcile(plan.cycles);

    if (plan.trackMemory === false) {
        return;
    }

    trace.sample(plan.cycles);

    const verdict = trace.verdict();

    note(verdict.report);

    expect(verdict.leaking ? verdict.report : 'growth decays').toBe('growth decays');
}
