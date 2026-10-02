import { ApplicationStore } from './store';
import { Comment, Project, Task } from './schemas';

/**
 * The query shapes an application issues, one per screen.
 *
 * This is the half of the harness that the existing scenarios have nothing like. They read a
 * collection and count it; an application asks a *different question on every screen*, and
 * the questions interact — a paginated list and an unpaginated one over the same collection
 * share a local cache and a change tracker, which is exactly where defect #48 lived.
 *
 * Each screen returns what it displays, so the journey can assert on it and the invariants
 * can cross-check one screen against another.
 */

export type PageRequest = { page: number; size: number };

/** A project list: filtered by organisation, sorted, paginated. The commonest shape there is. */
export async function projectListScreen(
    store: ApplicationStore,
    organisationId: string,
    page: PageRequest
): Promise<Project[]> {
    return await store.projects
        .where(([p, params]) => p.organisationId === params.organisationId, { organisationId })
        .sort(p => p.createdAt)
        .skip(page.page * page.size)
        .take(page.size)
        .toArrayAsync() as Project[];
}

/**
 * A task board: filtered by project AND status, sorted by a unique key, paginated.
 *
 * Sorted on `sequence` rather than `priority` deliberately. Paging over a non-unique sort key
 * has no defined answer — two rows with the same priority may land on either side of a page
 * boundary — so a test that did it would be asserting on an accident.
 */
export async function taskBoardScreen(
    store: ApplicationStore,
    projectId: string,
    status: string,
    page: PageRequest
): Promise<Task[]> {
    return await store.tasks
        .where(([t, params]) => t.projectId === params.projectId && t.status === params.status,
            { projectId, status })
        .sort(t => t.sequence)
        .skip(page.page * page.size)
        .take(page.size)
        .toArrayAsync() as Task[];
}

/** Walks every page of the task board and returns the concatenation. */
export async function taskBoardAllPages(
    store: ApplicationStore,
    projectId: string,
    status: string,
    size: number
): Promise<Task[]> {
    const collected: Task[] = [];

    for (let page = 0; ; page++) {
        const rows = await taskBoardScreen(store, projectId, status, { page, size });

        collected.push(...rows);

        if (rows.length < size) {
            return collected;
        }

        // A page that keeps returning a full window forever means the window is not being
        // applied; stop rather than loop until the timeout.
        if (page > 1_000) {
            throw new Error(`taskBoardAllPages: ${projectId}/${status} never reached a short page`);
        }
    }
}

/** A task detail view: the task, its comments, its attachments, its tags. Four reads, one screen. */
export async function taskDetailScreen(store: ApplicationStore, taskId: string) {
    const task = await store.tasks.firstOrUndefinedAsync(([t, params]) => t.id === params.taskId, { taskId });

    if (task == null) {
        return null;
    }

    const [comments, attachments, taskTags] = await Promise.all([
        store.comments
            .where(([c, params]) => c.taskId === params.taskId, { taskId })
            .sort(c => c.createdAt)
            .toArrayAsync(),
        store.attachments
            .where(([a, params]) => a.taskId === params.taskId, { taskId })
            .toArrayAsync(),
        store.taskTags
            .where(([tt, params]) => tt.taskId === params.taskId, { taskId })
            .toArrayAsync(),
    ]);

    return {
        task: task as Task,
        comments: comments as Comment[],
        attachments,
        taskTags,
    };
}

/**
 * A dashboard: aggregates over several collections.
 *
 * Counts rather than rows, which is a different code path — the translator pushes `count`
 * down where it can, and the answer has to agree with what the list screens return.
 */
export async function dashboardScreen(store: ApplicationStore, organisationId: string) {
    const projects = await store.projects
        .where(([p, params]) => p.organisationId === params.organisationId, { organisationId })
        .toArrayAsync() as Project[];

    const projectIds = new Set(projects.map(p => p.id));

    const allTasks = await store.tasks.toArrayAsync() as Task[];
    const tasks = allTasks.filter(task => projectIds.has(task.projectId));

    return {
        projectCount: projects.length,
        taskCount: tasks.length,
        openTaskCount: tasks.filter(task => task.status !== 'done').length,
        // The denormalised figure the projects carry, which should agree with the real one.
        reportedOpenTaskCount: projects.reduce((sum, project) => sum + project.openTaskCount, 0),
        memberCount: await store.memberships
            .where(([m, params]) => m.organisationId === params.organisationId, { organisationId })
            .countAsync(),
    };
}

/** A search: a substring match across tasks, unpaginated, as a type-ahead would issue it. */
export async function searchScreen(store: ApplicationStore, fragment: string): Promise<Task[]> {
    return await store.tasks
        .where(([t, params]) => t.title.includes(params.fragment), { fragment })
        .toArrayAsync() as Task[];
}

/** A user's unread notifications, the shape a header badge polls. */
export async function inboxScreen(store: ApplicationStore, userId: string) {
    return await store.notifications
        .where(([n, params]) => n.userId === params.userId && n.read === 0, { userId })
        .toArrayAsync();
}
