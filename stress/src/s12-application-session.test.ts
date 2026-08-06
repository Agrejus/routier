import { afterAll, expect } from '@jest/globals';
import { DataStore } from '@routier/datastore';
import { Backend, RICH_BACKENDS, cleanupBackendArtifacts, stressDescribe, stressIt } from './harness';
import { ApplicationStore } from './harness/application/store';
import { ApplicationModel, DEFAULT_SEED_PLAN, buildSeed, seedSize } from './harness/application/model';
import { emptyTally, resetCreatedCounter, runJourneyStep } from './harness/application/journey';
import {
    checkDenormalisedCounts,
    checkModelAgreement,
    checkPaginationCompleteness,
    checkReferentialIntegrity,
    collectionCounts,
    collectionFingerprints,
    type InvariantFailure,
} from './harness/application/invariants';
import { PROJECT_STATUSES, TASK_STATUSES } from './harness/application/schemas';

/**
 * S12 — an application session.
 *
 * Every other scenario drives ONE collection through ONE kind of work. That finds volume and
 * churn defects and structurally cannot find anything needing a second collection or a second
 * query shape — which is most of what an application is. `specs/joins.md` has never been
 * stressed, no scenario paginates, and defect #48 (a paginated read returning nothing) needed
 * only a second query shape to exist.
 *
 * So this is twelve collections with real references, six screens with distinct query shapes,
 * and a seeded journey that navigates between them the way a person does. What it asserts is
 * in `harness/application/invariants.ts`; each claim needs either two collections or two
 * shapes, which is why none of them could have been made before.
 *
 * The session is not a load. It is deliberately slower and smaller than S1 or S3 — the point
 * is the ORDER of operations across collections, not the rate.
 */

const PAGE_SIZE = 5;
const STEPS = 400;
const CHECKPOINT_EVERY = 100;

const stores: DataStore[] = [];

const track = <T extends DataStore>(store: T): T => {
    stores.push(store);
    return store;
};

afterAll(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }

    cleanupBackendArtifacts();
});

/** Every failure from one checkpoint, so a run reports all of them rather than the first. */
const report = (failures: InvariantFailure[]) =>
    failures.map(failure => `${failure.name}: ${failure.detail}`).join('\n  ');

stressDescribe('S12 application session: twelve collections, six screens, one user', () => {
    // Only the rich backends: SQLite is in the list too, but the model is deliberately
    // scalar-only so it can join. See the note in schemas.ts.
    const backends: Backend[] = RICH_BACKENDS;

    for (const backend of backends) {
        stressIt(
            `${backend.name}: a ${STEPS}-step session keeps twelve collections consistent`,
            {
                seed: 20260806,
                scale: {
                    backend: backend.name,
                    collections: 12,
                    steps: STEPS,
                    pageSize: PAGE_SIZE,
                    ...seedSize(DEFAULT_SEED_PLAN),
                },
            },
            async ({ rng, note }) => {
                resetCreatedCounter();

                const model = new ApplicationModel();
                buildSeed(model, rng, DEFAULT_SEED_PLAN);

                const store = track(new ApplicationStore(backend.create()));

                // Seeded in one save per collection rather than one save overall: a save
                // spanning twelve collections is its own scenario, and mixing it in here
                // would confuse a seeding failure with a session failure.
                await store.organisations.addAsync(...[...model.organisations.values()] as never[]);
                await store.users.addAsync(...[...model.users.values()] as never[]);
                await store.memberships.addAsync(...[...model.memberships.values()] as never[]);
                await store.tags.addAsync(...[...model.tags.values()] as never[]);
                await store.projects.addAsync(...[...model.projects.values()] as never[]);
                await store.milestones.addAsync(...[...model.milestones.values()] as never[]);
                await store.tasks.addAsync(...[...model.tasks.values()] as never[]);
                await store.comments.addAsync(...[...model.comments.values()] as never[]);
                await store.taskTags.addAsync(...[...model.taskTags.values()] as never[]);
                await store.saveChangesAsync();

                const seeded = await collectionCounts(store);
                note(`seeded: ${JSON.stringify(seeded)}`);

                expect(seeded.tasks).toBe(model.tasks.size);
                expect(seeded.comments).toBe(model.comments.size);

                const tally = emptyTally();

                for (let step = 0; step < STEPS; step++) {
                    await runJourneyStep({ store, model, rng, note, pageSize: PAGE_SIZE }, tally);

                    if ((step + 1) % CHECKPOINT_EVERY !== 0) {
                        continue;
                    }

                    const failures = [
                        ...await checkReferentialIntegrity(store),
                        ...await checkDenormalisedCounts(store),
                        ...await checkModelAgreement(store, model),
                    ];

                    if (failures.length > 0) {
                        note(`step ${step + 1}: ${failures.length} invariant failure(s)`);
                        expect(`step ${step + 1}\n  ${report(failures)}`).toBe('no invariant failures');
                    }
                }

                note(`journey: ${JSON.stringify(tally)}`);

                // A session that never wrote would pass everything above trivially.
                expect(tally.saves).toBeGreaterThan(20);

                const finalFailures = [
                    ...await checkReferentialIntegrity(store),
                    ...await checkDenormalisedCounts(store),
                    ...await checkModelAgreement(store, model),
                ];

                expect(finalFailures.length === 0 ? 'consistent' : report(finalFailures))
                    .toBe('consistent');
            }
        );

        stressIt(
            `${backend.name}: every page of every task board adds up to the unpaged answer`,
            {
                seed: 20260807,
                scale: {
                    backend: backend.name,
                    pageSize: PAGE_SIZE,
                    boards: DEFAULT_SEED_PLAN.projectsPerOrganisation * TASK_STATUSES.length,
                    ...seedSize(DEFAULT_SEED_PLAN),
                },
            },
            async ({ rng, note }) => {
                // Pagination gets its own scenario because it is the shape that has already
                // produced two defects (#48, #49) and the only one where a wrong answer is
                // silent: an empty page and a legitimately empty result look identical.
                resetCreatedCounter();

                const model = new ApplicationModel();
                buildSeed(model, rng, DEFAULT_SEED_PLAN);

                const store = track(new ApplicationStore(backend.create()));

                await store.organisations.addAsync(...[...model.organisations.values()] as never[]);
                await store.projects.addAsync(...[...model.projects.values()] as never[]);
                await store.milestones.addAsync(...[...model.milestones.values()] as never[]);
                await store.tasks.addAsync(...[...model.tasks.values()] as never[]);
                await store.saveChangesAsync();

                const failures: InvariantFailure[] = [];
                let boards = 0;
                let nonEmpty = 0;

                for (const project of model.projects.values()) {
                    for (const status of TASK_STATUSES) {
                        boards++;

                        const expected = model
                            .tasksOfProject(project.id)
                            .filter(task => task.status === status).length;

                        if (expected > 0) {
                            nonEmpty++;
                        }

                        failures.push(
                            ...await checkPaginationCompleteness(store, project.id, status, PAGE_SIZE)
                        );
                    }
                }

                note(`walked ${boards} boards, ${nonEmpty} of them non-empty, page size ${PAGE_SIZE}`);

                // If every board were empty the walk would prove nothing — an empty result and
                // a broken window are the same observation.
                expect(nonEmpty).toBeGreaterThan(10);

                expect(failures.length === 0 ? 'pages add up' : report(failures)).toBe('pages add up');
            }
        );

        stressIt(
            `${backend.name}: writing one collection leaves the other eleven alone`,
            {
                seed: 20260808,
                scale: { backend: backend.name, collections: 12, ...seedSize(DEFAULT_SEED_PLAN) },
            },
            async ({ rng, note }) => {
                // Twelve collections share one change tracker and one save pipeline. A save
                // that reached a collection it was not given would be invisible to every
                // single-collection scenario in this program.
                resetCreatedCounter();

                const model = new ApplicationModel();
                buildSeed(model, rng, DEFAULT_SEED_PLAN);

                const store = track(new ApplicationStore(backend.create()));

                await store.organisations.addAsync(...[...model.organisations.values()] as never[]);
                await store.users.addAsync(...[...model.users.values()] as never[]);
                await store.memberships.addAsync(...[...model.memberships.values()] as never[]);
                await store.tags.addAsync(...[...model.tags.values()] as never[]);
                await store.projects.addAsync(...[...model.projects.values()] as never[]);
                await store.milestones.addAsync(...[...model.milestones.values()] as never[]);
                await store.tasks.addAsync(...[...model.tasks.values()] as never[]);
                await store.comments.addAsync(...[...model.comments.values()] as never[]);
                await store.taskTags.addAsync(...[...model.taskTags.values()] as never[]);
                await store.saveChangesAsync();

                // Fingerprints, not counts. An update never changes a count, so a save that
                // corrupted a row in another collection would pass a count comparison
                // untouched — which would make this scenario look like it was checking
                // something while checking nothing.
                const before = await collectionFingerprints(store);

                // One write, to one collection.
                const [firstTask] = [...model.tasks.values()];
                const stored = await store.tasks.firstOrUndefinedAsync(
                    ([t, params]) => t.id === params.taskId, { taskId: firstTask.id }
                );

                (stored as { title: string }).title = 'touched by the isolation check';
                await store.saveChangesAsync();

                const after = await collectionFingerprints(store);

                note(`collections fingerprinted: ${Object.keys(before).length}`);

                const changed = Object.keys(before).filter(name => before[name] !== after[name]);

                // Exactly one collection may differ, and it must be the one written to.
                expect(changed).toEqual(['tasks']);

                // And the write did land, or the check above is vacuous.
                const reread = await store.tasks.firstOrUndefinedAsync(
                    ([t, params]) => t.id === params.taskId, { taskId: firstTask.id }
                );

                expect((reread as { title: string }).title).toBe('touched by the isolation check');
            }
        );
    }

    // Referenced so the status vocabulary stays in one place; a typo here should not compile.
    void PROJECT_STATUSES;
});
