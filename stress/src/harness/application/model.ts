import { Rng } from '../rng';
import {
    Activity,
    Attachment,
    Comment,
    Membership,
    Milestone,
    Notification,
    Organisation,
    Project,
    PROJECT_STATUSES,
    Tag,
    Task,
    TaskTag,
    TASK_STATUSES,
    User,
    isOpen,
} from './schemas';

/**
 * What the session believes is true, held in plain Maps.
 *
 * The datastore is the thing under test, so it cannot also be the reference. Every write the
 * journey makes is applied here as well, and the invariants compare the two. This is the same
 * shape as `Oracle`, kept separate because it models twelve related collections rather than
 * one flat set, and because the relationships are the point.
 */
export class ApplicationModel {
    readonly organisations = new Map<string, Organisation>();
    readonly users = new Map<string, User>();
    readonly memberships = new Map<string, Membership>();
    readonly projects = new Map<string, Project>();
    readonly milestones = new Map<string, Milestone>();
    readonly tasks = new Map<string, Task>();
    readonly comments = new Map<string, Comment>();
    readonly attachments = new Map<string, Attachment>();
    readonly tags = new Map<string, Tag>();
    readonly taskTags = new Map<string, TaskTag>();
    readonly activity = new Map<string, Activity>();
    readonly notifications = new Map<string, Notification>();

    /** Composite keys are joined the same way on both sides of every comparison. */
    static membershipKey = (organisationId: string, userId: string) => `${organisationId}|${userId}`;
    static taskTagKey = (taskId: string, tagId: string) => `${taskId}|${tagId}`;

    tasksOfProject(projectId: string): Task[] {
        return [...this.tasks.values()].filter(task => task.projectId === projectId);
    }

    openTaskCount(projectId: string): number {
        return this.tasksOfProject(projectId).filter(isOpen).length;
    }

    commentsOfTask(taskId: string): Comment[] {
        return [...this.comments.values()].filter(comment => comment.taskId === taskId);
    }
}

/**
 * Deterministic ids.
 *
 * `uuidv4()` would make a failing run unreproducible from its seed, which is the one thing
 * every scenario in this program is built to preserve.
 */
export const idFor = (kind: string, index: number) => `${kind}-${String(index).padStart(6, '0')}`;

export type SeedPlan = {
    organisations: number;
    usersPerOrganisation: number;
    projectsPerOrganisation: number;
    milestonesPerProject: number;
    tasksPerProject: number;
    commentsPerTask: number;
    tagsPerOrganisation: number;
};

export const DEFAULT_SEED_PLAN: SeedPlan = {
    organisations: 2,
    usersPerOrganisation: 8,
    projectsPerOrganisation: 6,
    milestonesPerProject: 3,
    tasksPerProject: 40,
    commentsPerTask: 2,
    tagsPerOrganisation: 6,
};

/** Total rows a plan produces, for the scale banner. */
export const seedSize = (plan: SeedPlan) => {
    const organisations = plan.organisations;
    const users = organisations * plan.usersPerOrganisation;
    const projects = organisations * plan.projectsPerOrganisation;
    const milestones = projects * plan.milestonesPerProject;
    const tasks = projects * plan.tasksPerProject;
    const comments = tasks * plan.commentsPerTask;

    return {
        organisations,
        users,
        memberships: users,
        projects,
        milestones,
        tasks,
        comments,
        tags: organisations * plan.tagsPerOrganisation,
        total: organisations + users * 2 + projects + milestones + tasks + comments
            + organisations * plan.tagsPerOrganisation,
    };
};

const iso = (dayOffset: number) => new Date(Date.UTC(2026, 0, 1 + dayOffset)).toISOString();

/**
 * Builds a consistent world in the model only.
 *
 * Nothing is written to the datastore here — the caller does that, so the journey can decide
 * whether to seed in one save or many, and so the model is never populated from the store it
 * is supposed to be checking.
 */
export function buildSeed(model: ApplicationModel, rng: Rng, plan: SeedPlan): void {
    let userIndex = 0;
    let projectIndex = 0;
    let milestoneIndex = 0;
    let taskIndex = 0;
    let commentIndex = 0;
    let tagIndex = 0;

    for (let o = 0; o < plan.organisations; o++) {
        const organisationId = idFor('org', o);

        model.organisations.set(organisationId, {
            id: organisationId,
            name: `Organisation ${o}`,
            plan: rng.pick(['free', 'team', 'enterprise']),
            createdAt: iso(o),
        });

        const orgUserIds: string[] = [];

        for (let u = 0; u < plan.usersPerOrganisation; u++) {
            const userId = idFor('user', userIndex++);
            orgUserIds.push(userId);

            model.users.set(userId, {
                id: userId,
                email: `${userId}@example.test`,
                displayName: `User ${userId}`,
                active: 1,
            });

            model.memberships.set(ApplicationModel.membershipKey(organisationId, userId), {
                organisationId,
                userId,
                role: u === 0 ? 'owner' : rng.pick(['admin', 'member', 'viewer']),
                joinedAt: iso(o + u),
            });
        }

        const orgTagIds: string[] = [];

        for (let t = 0; t < plan.tagsPerOrganisation; t++) {
            const tagId = idFor('tag', tagIndex++);
            orgTagIds.push(tagId);

            model.tags.set(tagId, { id: tagId, organisationId, label: `tag-${t}` });
        }

        for (let p = 0; p < plan.projectsPerOrganisation; p++) {
            const projectId = idFor('project', projectIndex++);
            const milestoneIds: string[] = [];

            for (let m = 0; m < plan.milestonesPerProject; m++) {
                const milestoneId = idFor('milestone', milestoneIndex++);
                milestoneIds.push(milestoneId);

                model.milestones.set(milestoneId, {
                    id: milestoneId,
                    projectId,
                    title: `Milestone ${m}`,
                    dueAt: iso(30 + m * 14),
                    reached: 0,
                });
            }

            for (let t = 0; t < plan.tasksPerProject; t++) {
                const taskId = idFor('task', taskIndex++);

                model.tasks.set(taskId, {
                    id: taskId,
                    projectId,
                    milestoneId: rng.chance(0.7) ? rng.pick(milestoneIds) : null,
                    assigneeId: rng.chance(0.8) ? rng.pick(orgUserIds) : null,
                    title: `Task ${t} of ${projectId}`,
                    status: rng.pick([...TASK_STATUSES]),
                    priority: rng.int(5),
                    // Globally unique and monotonic, so every paginated sort is total.
                    sequence: taskIndex,
                    updatedAt: iso(t % 90),
                });

                for (let c = 0; c < plan.commentsPerTask; c++) {
                    const commentId = idFor('comment', commentIndex++);

                    model.comments.set(commentId, {
                        id: commentId,
                        taskId,
                        authorId: rng.pick(orgUserIds),
                        body: `Comment ${c} on ${taskId}`,
                        createdAt: iso(c),
                    });
                }

                if (rng.chance(0.5)) {
                    const tagId = rng.pick(orgTagIds);

                    model.taskTags.set(ApplicationModel.taskTagKey(taskId, tagId), {
                        taskId,
                        tagId,
                        appliedAt: iso(t % 30),
                    });
                }
            }

            model.projects.set(projectId, {
                id: projectId,
                organisationId,
                name: `Project ${p}`,
                status: rng.pick([...PROJECT_STATUSES]),
                openTaskCount: 0,
                createdAt: iso(p),
            });
        }
    }

    // Set after the tasks exist, so the denormalised count starts truthful and any later
    // drift is the journey's doing.
    for (const project of model.projects.values()) {
        project.openTaskCount = model.openTaskCount(project.id);
    }
}
