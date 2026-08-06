import { ApplicationModel } from './model';
import { ApplicationStore } from './store';
import { taskBoardAllPages } from './screens';
import { Attachment, Comment, Membership, Milestone, Notification, Project, Task, TaskTag } from './schemas';

/**
 * What the session proves.
 *
 * A journey that navigates and writes and asserts nothing is a demo. These are the claims
 * that make it a test, and each one names a failure that no existing scenario could see
 * because each needs either two collections or two query shapes.
 */

export type InvariantFailure = { name: string; detail: string };

const sortedIds = (rows: { id: string }[]) => rows.map(row => row.id).sort();

/**
 * Every foreign key resolves.
 *
 * The failure this catches: a remove that leaves children pointing at a parent that is gone.
 * Nothing in the repository has ever had two related collections to get this wrong with.
 */
export async function checkReferentialIntegrity(
    store: ApplicationStore
): Promise<InvariantFailure[]> {
    const failures: InvariantFailure[] = [];

    const [organisations, users, projects, milestones, tasks, comments, attachments, memberships, taskTags, tags, notifications, activity] =
        await Promise.all([
            store.organisations.toArrayAsync(),
            store.users.toArrayAsync(),
            store.projects.toArrayAsync(),
            store.milestones.toArrayAsync(),
            store.tasks.toArrayAsync(),
            store.comments.toArrayAsync(),
            store.attachments.toArrayAsync(),
            store.memberships.toArrayAsync(),
            store.taskTags.toArrayAsync(),
            store.tags.toArrayAsync(),
            store.notifications.toArrayAsync(),
            store.activity.toArrayAsync(),
        ]);

    const organisationIds = new Set((organisations as { id: string }[]).map(o => o.id));
    const userIds = new Set((users as { id: string }[]).map(u => u.id));
    const projectIds = new Set((projects as Project[]).map(p => p.id));
    const milestoneIds = new Set((milestones as Milestone[]).map(m => m.id));
    const taskIds = new Set((tasks as Task[]).map(t => t.id));
    const tagIds = new Set((tags as { id: string }[]).map(t => t.id));
    const activityIds = new Set((activity as { id: string }[]).map(a => a.id));

    const dangling = (name: string, rows: { key: string; target: string | null; set: Set<string> }[]) => {
        for (const row of rows) {
            if (row.target == null) {
                continue;
            }

            if (row.set.has(row.target) === false) {
                failures.push({ name, detail: `${row.key} references missing ${row.target}` });
                return;
            }
        }
    };

    dangling('project.organisationId', (projects as Project[]).map(p => ({
        key: p.id, target: p.organisationId, set: organisationIds,
    })));
    dangling('milestone.projectId', (milestones as Milestone[]).map(m => ({
        key: m.id, target: m.projectId, set: projectIds,
    })));
    dangling('task.projectId', (tasks as Task[]).map(t => ({
        key: t.id, target: t.projectId, set: projectIds,
    })));
    dangling('task.milestoneId', (tasks as Task[]).map(t => ({
        key: t.id, target: t.milestoneId, set: milestoneIds,
    })));
    dangling('task.assigneeId', (tasks as Task[]).map(t => ({
        key: t.id, target: t.assigneeId, set: userIds,
    })));
    dangling('comment.taskId', (comments as Comment[]).map(c => ({
        key: c.id, target: c.taskId, set: taskIds,
    })));
    dangling('attachment.taskId', (attachments as Attachment[]).map(a => ({
        key: a.id, target: a.taskId, set: taskIds,
    })));
    dangling('membership.userId', (memberships as Membership[]).map(m => ({
        key: `${m.organisationId}|${m.userId}`, target: m.userId, set: userIds,
    })));
    dangling('taskTag.taskId', (taskTags as TaskTag[]).map(tt => ({
        key: `${tt.taskId}|${tt.tagId}`, target: tt.taskId, set: taskIds,
    })));
    dangling('taskTag.tagId', (taskTags as TaskTag[]).map(tt => ({
        key: `${tt.taskId}|${tt.tagId}`, target: tt.tagId, set: tagIds,
    })));
    dangling('notification.activityId', (notifications as Notification[]).map(n => ({
        key: n.id, target: n.activityId, set: activityIds,
    })));

    return failures;
}

/**
 * Walking every page returns exactly the unpaged set — no gaps, no duplicates.
 *
 * This is defect #48's shape written as an invariant. A window applied twice returns nothing,
 * a window applied to the wrong candidate set returns the wrong rows, and neither is visible
 * to a scenario that only ever reads a whole collection.
 */
export async function checkPaginationCompleteness(
    store: ApplicationStore,
    projectId: string,
    status: string,
    pageSize: number
): Promise<InvariantFailure[]> {
    const unpaged = await store.tasks
        .where(([t, params]) => t.projectId === params.projectId && t.status === params.status,
            { projectId, status })
        .sort(t => t.sequence)
        .toArrayAsync() as Task[];

    const paged = await taskBoardAllPages(store, projectId, status, pageSize);

    const failures: InvariantFailure[] = [];
    const pagedIds = paged.map(t => t.id);
    const uniquePagedIds = new Set(pagedIds);

    if (uniquePagedIds.size !== pagedIds.length) {
        failures.push({
            name: 'pagination.duplicates',
            detail: `${projectId}/${status}: ${pagedIds.length} rows across pages, ${uniquePagedIds.size} distinct`,
        });
    }

    const expected = sortedIds(unpaged);
    const actual = [...uniquePagedIds].sort();

    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        const missing = expected.filter(id => uniquePagedIds.has(id) === false);
        const extra = actual.filter(id => unpaged.some(t => t.id === id) === false);

        failures.push({
            name: 'pagination.completeness',
            detail:
                `${projectId}/${status}: unpaged ${expected.length} rows, paged ${actual.length}` +
                (missing.length > 0 ? `; missing ${missing.slice(0, 3).join(', ')}` : '') +
                (extra.length > 0 ? `; unexpected ${extra.slice(0, 3).join(', ')}` : ''),
        });
    }

    // Order has to survive paging too, or the list a user scrolls is not the list they sorted.
    const pagedInOrder = paged.map(t => t.sequence);
    const ascending = [...pagedInOrder].sort((a, b) => a - b);

    if (JSON.stringify(pagedInOrder) !== JSON.stringify(ascending)) {
        failures.push({
            name: 'pagination.ordering',
            detail: `${projectId}/${status}: pages did not come back in sort order`,
        });
    }

    return failures;
}

/**
 * The denormalised count agrees with the rows it counts.
 *
 * An application caches an aggregate on its parent and updates it on write; the bug is always
 * a path that changes a child without updating the parent. This needs two collections to
 * exist and a journey that writes to both.
 */
export async function checkDenormalisedCounts(
    store: ApplicationStore
): Promise<InvariantFailure[]> {
    const [projects, tasks] = await Promise.all([
        store.projects.toArrayAsync() as Promise<Project[]>,
        store.tasks.toArrayAsync() as Promise<Task[]>,
    ]);

    const failures: InvariantFailure[] = [];
    const openByProject = new Map<string, number>();

    for (const task of tasks) {
        if (task.status === 'done') {
            continue;
        }

        openByProject.set(task.projectId, (openByProject.get(task.projectId) ?? 0) + 1);
    }

    for (const project of projects) {
        const real = openByProject.get(project.id) ?? 0;

        if (project.openTaskCount !== real) {
            failures.push({
                name: 'denormalised.openTaskCount',
                detail: `${project.id}: reported ${project.openTaskCount}, actual ${real}`,
            });
        }
    }

    return failures;
}

/** The store agrees with the model, collection by collection. */
export async function checkModelAgreement(
    store: ApplicationStore,
    model: ApplicationModel
): Promise<InvariantFailure[]> {
    const failures: InvariantFailure[] = [];

    const compare = async (
        name: string,
        actual: Promise<unknown[]>,
        expectedKeys: string[],
        keyOf: (row: any) => string
    ) => {
        const rows = await actual;
        const actualKeys = rows.map(keyOf).sort();
        const expected = [...expectedKeys].sort();

        if (actualKeys.length !== expected.length) {
            failures.push({
                name: `model.${name}`,
                detail: `store has ${actualKeys.length}, model has ${expected.length}`,
            });
            return;
        }

        for (let i = 0; i < expected.length; i++) {
            if (actualKeys[i] !== expected[i]) {
                failures.push({
                    name: `model.${name}`,
                    detail: `first divergence: store ${actualKeys[i]}, model ${expected[i]}`,
                });
                return;
            }
        }
    };

    await compare('projects', store.projects.toArrayAsync(), [...model.projects.keys()], r => r.id);
    await compare('tasks', store.tasks.toArrayAsync(), [...model.tasks.keys()], r => r.id);
    await compare('comments', store.comments.toArrayAsync(), [...model.comments.keys()], r => r.id);
    await compare('milestones', store.milestones.toArrayAsync(), [...model.milestones.keys()], r => r.id);
    await compare(
        'memberships',
        store.memberships.toArrayAsync(),
        [...model.memberships.keys()],
        r => ApplicationModel.membershipKey(r.organisationId, r.userId)
    );
    await compare(
        'taskTags',
        store.taskTags.toArrayAsync(),
        [...model.taskTags.keys()],
        r => ApplicationModel.taskTagKey(r.taskId, r.tagId)
    );

    return failures;
}

/**
 * A content fingerprint per collection, for proving a save touched only what it was given.
 *
 * Counts alone would not do it: an update never changes a count, so a save that corrupted a
 * row in another collection would pass a count comparison unchanged. This hashes the rows.
 */
export async function collectionFingerprints(store: ApplicationStore): Promise<Record<string, string>> {
    const stable = (rows: unknown[]) =>
        JSON.stringify(
            (rows as Record<string, unknown>[])
                .map(row => Object.keys(row).sort().map(key => `${key}=${String(row[key])}`).join('|'))
                .sort()
        );

    const [
        organisations, users, memberships, projects, milestones,
        tasks, comments, attachments, tags, taskTags, activity, notifications,
    ] = await Promise.all([
        store.organisations.toArrayAsync(),
        store.users.toArrayAsync(),
        store.memberships.toArrayAsync(),
        store.projects.toArrayAsync(),
        store.milestones.toArrayAsync(),
        store.tasks.toArrayAsync(),
        store.comments.toArrayAsync(),
        store.attachments.toArrayAsync(),
        store.tags.toArrayAsync(),
        store.taskTags.toArrayAsync(),
        store.activity.toArrayAsync(),
        store.notifications.toArrayAsync(),
    ]);

    return {
        organisations: stable(organisations),
        users: stable(users),
        memberships: stable(memberships),
        projects: stable(projects),
        milestones: stable(milestones),
        tasks: stable(tasks),
        comments: stable(comments),
        attachments: stable(attachments),
        tags: stable(tags),
        taskTags: stable(taskTags),
        activity: stable(activity),
        notifications: stable(notifications),
    };
}

/**
 * Writing one collection does not disturb another.
 *
 * Twelve collections share one change tracker and one save pipeline. A save that touched a
 * collection it was not given would be invisible to every single-collection scenario.
 */
export async function collectionCounts(store: ApplicationStore): Promise<Record<string, number>> {
    const [
        organisations, users, memberships, projects, milestones,
        tasks, comments, attachments, tags, taskTags, activity, notifications,
    ] = await Promise.all([
        store.organisations.countAsync(),
        store.users.countAsync(),
        store.memberships.countAsync(),
        store.projects.countAsync(),
        store.milestones.countAsync(),
        store.tasks.countAsync(),
        store.comments.countAsync(),
        store.attachments.countAsync(),
        store.tags.countAsync(),
        store.taskTags.countAsync(),
        store.activity.countAsync(),
        store.notifications.countAsync(),
    ]);

    return {
        organisations, users, memberships, projects, milestones,
        tasks, comments, attachments, tags, taskTags, activity, notifications,
    };
}
