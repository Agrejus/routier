import { afterEach, describe, expect, it } from '@jest/globals';
import { MemoryPlugin } from '@routier/memory-plugin';
import { uuidv4 } from '@routier/core';
import { Rng } from '../rng';
import { ApplicationStore } from './store';
import { ApplicationModel, buildSeed, type SeedPlan } from './model';
import {
    checkDenormalisedCounts,
    checkModelAgreement,
    checkPaginationCompleteness,
    checkReferentialIntegrity,
    collectionCounts,
} from './invariants';
import { Project, Task } from './schemas';

/**
 * The invariants test themselves, and like the rest of the harness they are NOT gated on
 * STRESS=1.
 *
 * S12 passes. That is worth nothing until each of its claims is shown to FAIL on the
 * corruption it exists to catch — a green check that cannot go red is not a check. Every test
 * below breaks the store in one specific way and asserts the matching invariant notices, and
 * asserts the others stay quiet so a failure names the right thing.
 */

const SMALL: SeedPlan = {
    organisations: 1,
    usersPerOrganisation: 3,
    projectsPerOrganisation: 2,
    milestonesPerProject: 1,
    tasksPerProject: 12,
    commentsPerTask: 1,
    tagsPerOrganisation: 2,
};

const stores: ApplicationStore[] = [];

const seeded = async () => {
    const model = new ApplicationModel();
    buildSeed(model, new Rng(1234), SMALL);

    const store = new ApplicationStore(new MemoryPlugin(`inv-${uuidv4()}`));
    stores.push(store);

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

    return { store, model };
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe('application invariants', () => {
    describe('a clean seed', () => {
        it('satisfies every invariant', async () => {
            const { store, model } = await seeded();

            expect(await checkReferentialIntegrity(store)).toEqual([]);
            expect(await checkDenormalisedCounts(store)).toEqual([]);
            expect(await checkModelAgreement(store, model)).toEqual([]);
        });

        it('walks every page of a board back to the unpaged answer', async () => {
            const { store, model } = await seeded();
            const [project] = [...model.projects.values()];

            // A status with rows in it, or the walk proves nothing.
            const status = ['todo', 'in-progress', 'blocked', 'done'].find(
                candidate => model.tasksOfProject(project.id).some(task => task.status === candidate)
            )!;

            expect(await checkPaginationCompleteness(store, project.id, status, 3)).toEqual([]);
        });
    });

    describe('referential integrity', () => {
        it('catches a comment orphaned by a deleted task', async () => {
            const { store } = await seeded();

            // Exactly the mistake an application makes: remove the parent, forget the child.
            const [task] = await store.tasks.toArrayAsync() as Task[];
            await store.tasks.removeAsync(task as never);
            await store.saveChangesAsync();

            const failures = await checkReferentialIntegrity(store);

            expect(failures.map(f => f.name)).toContain('comment.taskId');
        });

        it('catches a task pointing at a deleted project', async () => {
            const { store } = await seeded();

            const [project] = await store.projects.toArrayAsync() as Project[];
            await store.projects.removeAsync(project as never);
            await store.saveChangesAsync();

            const failures = await checkReferentialIntegrity(store);

            expect(failures.map(f => f.name)).toContain('task.projectId');
        });

        it('catches a dangling assignee', async () => {
            const { store } = await seeded();

            const tasks = await store.tasks.toArrayAsync() as Task[];
            const assigned = tasks.find(task => task.assigneeId != null)!;

            assigned.assigneeId = 'user-does-not-exist';
            await store.saveChangesAsync();

            const failures = await checkReferentialIntegrity(store);

            expect(failures.map(f => f.name)).toContain('task.assigneeId');
        });

        it('accepts a null reference, which is not dangling', async () => {
            const { store } = await seeded();

            const tasks = await store.tasks.toArrayAsync() as Task[];

            for (const task of tasks) {
                task.assigneeId = null;
                task.milestoneId = null;
            }

            await store.saveChangesAsync();

            expect(await checkReferentialIntegrity(store)).toEqual([]);
        });
    });

    describe('denormalised counts', () => {
        it('catches a status change that did not update the parent', async () => {
            const { store } = await seeded();

            const tasks = await store.tasks.toArrayAsync() as Task[];
            const open = tasks.find(task => task.status !== 'done')!;

            // Closing a task without decrementing its project — the drift an application
            // introduces the moment one code path forgets.
            open.status = 'done';
            await store.saveChangesAsync();

            const failures = await checkDenormalisedCounts(store);

            expect(failures.map(f => f.name)).toContain('denormalised.openTaskCount');
            expect(failures[0].detail).toContain(open.projectId);
        });

        it('stays quiet when the count is maintained', async () => {
            const { store } = await seeded();

            const tasks = await store.tasks.toArrayAsync() as Task[];
            const open = tasks.find(task => task.status !== 'done')!;
            const projects = await store.projects.toArrayAsync() as Project[];
            const project = projects.find(candidate => candidate.id === open.projectId)!;

            open.status = 'done';
            project.openTaskCount -= 1;
            await store.saveChangesAsync();

            expect(await checkDenormalisedCounts(store)).toEqual([]);
        });
    });

    describe('model agreement', () => {
        it('catches a row the store has and the model does not', async () => {
            const { store, model } = await seeded();

            await store.tasks.addAsync({
                id: 'ghost-task',
                projectId: [...model.projects.keys()][0],
                milestoneId: null,
                assigneeId: null,
                title: 'not in the model',
                status: 'todo',
                priority: 0,
                sequence: 99_999,
                updatedAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
            } as never);
            await store.saveChangesAsync();

            const failures = await checkModelAgreement(store, model);

            expect(failures.map(f => f.name)).toContain('model.tasks');
        });

        it('catches a row the model has and the store does not', async () => {
            const { store, model } = await seeded();

            const [task] = await store.tasks.toArrayAsync() as Task[];
            await store.tasks.removeAsync(task as never);
            await store.saveChangesAsync();

            const failures = await checkModelAgreement(store, model);

            expect(failures.map(f => f.name)).toContain('model.tasks');
        });

        it('compares composite keys on both sides', async () => {
            // A membership is keyed (organisationId, userId). Comparing on one component would
            // report agreement while the pairing was wrong.
            const { store, model } = await seeded();

            const memberships = await store.memberships.toArrayAsync();
            await store.memberships.removeAsync(memberships[0] as never);
            await store.saveChangesAsync();

            const failures = await checkModelAgreement(store, model);

            expect(failures.map(f => f.name)).toContain('model.memberships');
        });
    });

    describe('pagination completeness', () => {
        /**
         * A store whose paginated reads drop the last row of every page.
         *
         * This is defect #48's family without reintroducing it: the point is to prove the
         * invariant NOTICES a windowed read disagreeing with an unwindowed one, whatever the
         * cause. Wrapping the collection is how that is done without touching the plugin.
         */
        const withLossyPaging = (store: ApplicationStore) => {
            const tasks = store.tasks as unknown as Record<string, unknown>;
            const original = (store.tasks as { where: Function }).where.bind(store.tasks);

            tasks.where = (...whereArgs: unknown[]) => {
                const query = original(...whereArgs);
                const sort = (query as { sort: Function }).sort.bind(query);

                (query as Record<string, unknown>).sort = (...sortArgs: unknown[]) => {
                    const sorted = sort(...sortArgs);
                    const skip = (sorted as { skip: Function }).skip.bind(sorted);

                    (sorted as Record<string, unknown>).skip = (n: number) => {
                        const skipped = skip(n);
                        const take = (skipped as { take: Function }).take.bind(skipped);

                        // One fewer than asked for, on every page.
                        (skipped as Record<string, unknown>).take = (size: number) =>
                            take(Math.max(0, size - 1));

                        return skipped;
                    };

                    return sorted;
                };

                return query;
            };
        };

        it('catches pages that do not add up to the whole', async () => {
            const { store, model } = await seeded();
            const [project] = [...model.projects.values()];
            const status = ['todo', 'in-progress', 'blocked', 'done'].find(
                candidate => model.tasksOfProject(project.id).filter(t => t.status === candidate).length >= 4
            );

            if (status == null) {
                throw new Error('seed produced no board with enough rows to page');
            }

            withLossyPaging(store);

            const failures = await checkPaginationCompleteness(store, project.id, status, 3);

            expect(failures.map(f => f.name)).toContain('pagination.completeness');
        });
    });

    describe('collection counts', () => {
        it('reports every collection', async () => {
            const { store } = await seeded();
            const counts = await collectionCounts(store);

            expect(Object.keys(counts)).toHaveLength(12);
            expect(counts.tasks).toBeGreaterThan(0);
            expect(counts.comments).toBeGreaterThan(0);
        });
    });
});
