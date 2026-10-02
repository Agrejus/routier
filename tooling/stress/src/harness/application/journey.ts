import { Rng } from '../rng';
import { ApplicationModel, idFor } from './model';
import { ApplicationStore } from './store';
import {
    dashboardScreen,
    inboxScreen,
    projectListScreen,
    searchScreen,
    taskBoardScreen,
    taskDetailScreen,
} from './screens';
import { Task, TASK_STATUSES, isOpen } from './schemas';

/**
 * A session: navigate, read, edit, navigate back, repeat.
 *
 * The existing loads do one kind of work at one collection as fast as they can. This does
 * what a person does — opens a list, opens something on it, changes it, goes back, opens
 * something else — and the value is in the ORDER. Reading a paginated board and then an
 * unpaginated search touches the same collection through two shapes, and that interaction is
 * what defect #48 lived in.
 *
 * Every step applies its write to the model as well, so a checkpoint can compare the two.
 */

export type JourneyStep =
    | 'browse-projects'
    | 'open-task-board'
    | 'open-task'
    | 'comment-on-task'
    | 'change-task-status'
    | 'reassign-task'
    | 'add-task'
    | 'delete-task'
    | 'search'
    | 'dashboard'
    | 'inbox';

/** How often each step is chosen. Reads dominate, as they do in any real application. */
const STEP_WEIGHTS: [JourneyStep, number][] = [
    ['browse-projects', 14],
    ['open-task-board', 18],
    ['open-task', 16],
    ['dashboard', 8],
    ['search', 6],
    ['inbox', 4],
    ['comment-on-task', 10],
    ['change-task-status', 10],
    ['reassign-task', 6],
    ['add-task', 5],
    ['delete-task', 3],
];

const WEIGHTED_STEPS: JourneyStep[] = STEP_WEIGHTS.flatMap(([step, weight]) =>
    Array.from({ length: weight }, () => step)
);

export type JourneyContext = {
    store: ApplicationStore;
    model: ApplicationModel;
    rng: Rng;
    note: (message: string) => void;
    pageSize: number;
};

/** Counters, so the scale banner can say what the session actually did. */
export type JourneyTally = Record<JourneyStep, number> & { saves: number };

export const emptyTally = (): JourneyTally => ({
    'browse-projects': 0,
    'open-task-board': 0,
    'open-task': 0,
    'comment-on-task': 0,
    'change-task-status': 0,
    'reassign-task': 0,
    'add-task': 0,
    'delete-task': 0,
    search: 0,
    dashboard: 0,
    inbox: 0,
    saves: 0,
});

/** Ids only the journey creates, kept out of the seed's numbering. */
let createdCounter = 1_000_000;

export const resetCreatedCounter = () => {
    createdCounter = 1_000_000;
};

export async function runJourneyStep(
    context: JourneyContext,
    tally: JourneyTally
): Promise<void> {
    const { store, model, rng } = context;
    const step = rng.pick(WEIGHTED_STEPS);

    tally[step]++;

    const organisationIds = [...model.organisations.keys()];
    const projectIds = [...model.projects.keys()];
    const taskIds = [...model.tasks.keys()];
    const userIds = [...model.users.keys()];

    switch (step) {
        case 'browse-projects': {
            const organisationId = rng.pick(organisationIds);
            const pages = Math.max(1, Math.ceil(
                [...model.projects.values()].filter(p => p.organisationId === organisationId).length / context.pageSize
            ));

            await projectListScreen(store, organisationId, {
                page: rng.int(pages),
                size: context.pageSize,
            });
            return;
        }

        case 'open-task-board': {
            const projectId = rng.pick(projectIds);
            const status = rng.pick([...TASK_STATUSES]);

            await taskBoardScreen(store, projectId, status, { page: 0, size: context.pageSize });
            return;
        }

        case 'open-task': {
            if (taskIds.length === 0) {
                return;
            }

            await taskDetailScreen(store, rng.pick(taskIds));
            return;
        }

        case 'dashboard': {
            await dashboardScreen(store, rng.pick(organisationIds));
            return;
        }

        case 'search': {
            await searchScreen(store, `Task ${rng.int(10)}`);
            return;
        }

        case 'inbox': {
            await inboxScreen(store, rng.pick(userIds));
            return;
        }

        case 'comment-on-task': {
            if (taskIds.length === 0) {
                return;
            }

            const taskId = rng.pick(taskIds);
            const commentId = idFor('comment', createdCounter++);
            const authorId = rng.pick(userIds);
            const comment = {
                id: commentId,
                taskId,
                authorId,
                body: `Session comment on ${taskId}`,
                createdAt: new Date(Date.UTC(2026, 5, 1)).toISOString(),
            };

            await store.comments.addAsync(comment as never);
            await store.saveChangesAsync();

            model.comments.set(commentId, comment);
            tally.saves++;
            return;
        }

        case 'change-task-status': {
            if (taskIds.length === 0) {
                return;
            }

            const taskId = rng.pick(taskIds);
            const modelTask = model.tasks.get(taskId)!;
            const nextStatus = rng.pick([...TASK_STATUSES]);

            if (nextStatus === modelTask.status) {
                return;
            }

            const stored = await store.tasks.firstOrUndefinedAsync(
                ([t, params]) => t.id === params.taskId, { taskId }
            );

            if (stored == null) {
                throw new Error(`change-task-status: ${taskId} is in the model but not the store`);
            }

            const wasOpen = isOpen(modelTask);
            (stored as Task).status = nextStatus;

            // The denormalised count is maintained by the application, in the same save. A
            // path that forgets is exactly what checkDenormalisedCounts is for.
            const project = await store.projects.firstOrUndefinedAsync(
                ([p, params]) => p.id === params.projectId, { projectId: modelTask.projectId }
            );

            const nowOpen = nextStatus !== 'done';
            const delta = (nowOpen ? 1 : 0) - (wasOpen ? 1 : 0);

            if (project != null && delta !== 0) {
                (project as { openTaskCount: number }).openTaskCount += delta;
            }

            await store.saveChangesAsync();

            modelTask.status = nextStatus;
            const modelProject = model.projects.get(modelTask.projectId);

            if (modelProject != null && delta !== 0) {
                modelProject.openTaskCount += delta;
            }

            tally.saves++;
            return;
        }

        case 'reassign-task': {
            if (taskIds.length === 0) {
                return;
            }

            const taskId = rng.pick(taskIds);
            const assigneeId = rng.chance(0.9) ? rng.pick(userIds) : null;

            const stored = await store.tasks.firstOrUndefinedAsync(
                ([t, params]) => t.id === params.taskId, { taskId }
            );

            if (stored == null) {
                throw new Error(`reassign-task: ${taskId} is in the model but not the store`);
            }

            (stored as Task).assigneeId = assigneeId;
            await store.saveChangesAsync();

            model.tasks.get(taskId)!.assigneeId = assigneeId;
            tally.saves++;
            return;
        }

        case 'add-task': {
            const projectId = rng.pick(projectIds);
            const taskId = idFor('task', createdCounter++);
            const task: Task = {
                id: taskId,
                projectId,
                milestoneId: null,
                assigneeId: rng.chance(0.8) ? rng.pick(userIds) : null,
                title: `Session task ${taskId}`,
                status: 'todo',
                priority: rng.int(5),
                sequence: createdCounter,
                updatedAt: new Date(Date.UTC(2026, 5, 1)).toISOString(),
            };

            await store.tasks.addAsync(task as never);

            const project = await store.projects.firstOrUndefinedAsync(
                ([p, params]) => p.id === params.projectId, { projectId }
            );

            if (project != null) {
                (project as { openTaskCount: number }).openTaskCount += 1;
            }

            await store.saveChangesAsync();

            model.tasks.set(taskId, task);
            const modelProject = model.projects.get(projectId);

            if (modelProject != null) {
                modelProject.openTaskCount += 1;
            }

            tally.saves++;
            return;
        }

        case 'delete-task': {
            if (taskIds.length === 0) {
                return;
            }

            const taskId = rng.pick(taskIds);
            const modelTask = model.tasks.get(taskId)!;

            const stored = await store.tasks.firstOrUndefinedAsync(
                ([t, params]) => t.id === params.taskId, { taskId }
            );

            if (stored == null) {
                throw new Error(`delete-task: ${taskId} is in the model but not the store`);
            }

            // Children go with the parent, because nothing else enforces that — Routier has no
            // cascade, and referential integrity is the application's to keep. A delete that
            // skipped this is precisely what checkReferentialIntegrity catches.
            const comments = await store.comments
                .where(([c, params]) => c.taskId === params.taskId, { taskId })
                .toArrayAsync();
            const attachments = await store.attachments
                .where(([a, params]) => a.taskId === params.taskId, { taskId })
                .toArrayAsync();
            const taskTags = await store.taskTags
                .where(([tt, params]) => tt.taskId === params.taskId, { taskId })
                .toArrayAsync();

            if (comments.length > 0) {
                await store.comments.removeAsync(...comments as never[]);
            }

            if (attachments.length > 0) {
                await store.attachments.removeAsync(...attachments as never[]);
            }

            if (taskTags.length > 0) {
                await store.taskTags.removeAsync(...taskTags as never[]);
            }

            await store.tasks.removeAsync(stored as never);

            const project = await store.projects.firstOrUndefinedAsync(
                ([p, params]) => p.id === params.projectId, { projectId: modelTask.projectId }
            );

            if (project != null && isOpen(modelTask)) {
                (project as { openTaskCount: number }).openTaskCount -= 1;
            }

            await store.saveChangesAsync();

            for (const comment of comments as { id: string }[]) {
                model.comments.delete(comment.id);
            }

            for (const attachment of attachments as { id: string }[]) {
                model.attachments.delete(attachment.id);
            }

            for (const taskTag of taskTags as { taskId: string; tagId: string }[]) {
                model.taskTags.delete(ApplicationModel.taskTagKey(taskTag.taskId, taskTag.tagId));
            }

            model.tasks.delete(taskId);

            const modelProject = model.projects.get(modelTask.projectId);

            if (modelProject != null && isOpen(modelTask)) {
                modelProject.openTaskCount -= 1;
            }

            tally.saves++;
            return;
        }
    }
}
