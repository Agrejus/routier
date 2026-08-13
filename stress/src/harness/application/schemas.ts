import { s } from '@routier/core/schema';

/**
 * The shape of an application, rather than the shape of a load.
 *
 * Every scenario in this program drives one collection through one kind of work. That finds
 * volume and churn defects, and it cannot find anything that needs a SECOND collection to
 * exist — a stale foreign key, a count that disagrees with the rows it counts, a page that
 * loses rows because a different screen was read first. `specs/joins.md` has been unstressed
 * since it was written, and defect #48 needed nothing more exotic than a second query shape.
 *
 * So this is twelve collections with real references between them, at the size and shape a
 * small production application has:
 *
 *     organisation
 *       └── membership ──── user
 *       └── project ──┬──── milestone
 *                     ├──── task ──┬── comment
 *                     │            ├── attachment
 *                     │            └── taskTag ──── tag
 *                     └──── activity
 *                                  notification ──── user
 *
 * ## Why every field is a scalar
 *
 * SQLite declines rich types in its own contract run: it has no native boolean, date, array
 * or object column, and a schema that uses them there is testing per-property serializers
 * rather than the plugin. Keeping this model scalar means the same session runs unchanged on
 * memory, file-system and SQLite, and a divergence between them is a finding rather than a
 * known limitation. Dates are ISO strings and booleans are 0/1 for the same reason.
 *
 * References are plain string ids, not a join type. Routier has no joins; an application
 * resolves them itself, and this model does what an application does.
 */

export const organisationSchema = s.define('app_organisations', {
    id: s.string().key(),
    name: s.string(),
    plan: s.string(),
    createdAt: s.string(),
}).compile();

export const userSchema = s.define('app_users', {
    id: s.string().key(),
    email: s.string(),
    displayName: s.string(),
    active: s.number(),
}).compile();

/** users ↔ organisations. A composite key, because a user joins an org at most once. */
export const membershipSchema = s.define('app_memberships', {
    organisationId: s.string().key(),
    userId: s.string().key(),
    role: s.string(),
    joinedAt: s.string(),
}).compile();

export const projectSchema = s.define('app_projects', {
    id: s.string().key(),
    organisationId: s.string(),
    name: s.string(),
    status: s.string(),
    /** Denormalised, and therefore something the invariants can catch drifting. */
    openTaskCount: s.number(),
    createdAt: s.string(),
}).compile();

export const milestoneSchema = s.define('app_milestones', {
    id: s.string().key(),
    projectId: s.string(),
    title: s.string(),
    dueAt: s.string(),
    reached: s.number(),
}).compile();

export const taskSchema = s.define('app_tasks', {
    id: s.string().key(),
    projectId: s.string(),
    milestoneId: s.string().nullable(),
    assigneeId: s.string().nullable(),
    title: s.string(),
    status: s.string(),
    priority: s.number(),
    /** Stable sort key. Ordering by a non-unique column makes pagination non-deterministic. */
    sequence: s.number(),
    updatedAt: s.string(),
}).compile();

export const commentSchema = s.define('app_comments', {
    id: s.string().key(),
    taskId: s.string(),
    authorId: s.string(),
    body: s.string(),
    createdAt: s.string(),
}).compile();

export const attachmentSchema = s.define('app_attachments', {
    id: s.string().key(),
    taskId: s.string(),
    filename: s.string(),
    sizeBytes: s.number(),
}).compile();

export const tagSchema = s.define('app_tags', {
    id: s.string().key(),
    organisationId: s.string(),
    label: s.string(),
}).compile();

/** tasks ↔ tags, the other composite key in the model. */
export const taskTagSchema = s.define('app_task_tags', {
    taskId: s.string().key(),
    tagId: s.string().key(),
    appliedAt: s.string(),
}).compile();

export const activitySchema = s.define('app_activity', {
    id: s.string().key(),
    projectId: s.string(),
    actorId: s.string(),
    verb: s.string(),
    subjectId: s.string(),
    at: s.string(),
}).compile();

export const notificationSchema = s.define('app_notifications', {
    id: s.string().key(),
    userId: s.string(),
    activityId: s.string(),
    read: s.number(),
}).compile();

export type Organisation = { id: string; name: string; plan: string; createdAt: string };
export type User = { id: string; email: string; displayName: string; active: number };
export type Membership = { organisationId: string; userId: string; role: string; joinedAt: string };
export type Project = {
    id: string;
    organisationId: string;
    name: string;
    status: string;
    openTaskCount: number;
    createdAt: string;
};
export type Milestone = { id: string; projectId: string; title: string; dueAt: string; reached: number };
export type Task = {
    id: string;
    projectId: string;
    milestoneId: string | null;
    assigneeId: string | null;
    title: string;
    status: string;
    priority: number;
    sequence: number;
    updatedAt: string;
};
export type Comment = { id: string; taskId: string; authorId: string; body: string; createdAt: string };
export type Attachment = { id: string; taskId: string; filename: string; sizeBytes: number };
export type Tag = { id: string; organisationId: string; label: string };
export type TaskTag = { taskId: string; tagId: string; appliedAt: string };
export type Activity = {
    id: string;
    projectId: string;
    actorId: string;
    verb: string;
    subjectId: string;
    at: string;
};
export type Notification = { id: string; userId: string; activityId: string; read: number };

export const TASK_STATUSES = ['todo', 'in-progress', 'blocked', 'done'] as const;
export const PROJECT_STATUSES = ['active', 'paused', 'archived'] as const;

/** A task counts against `project.openTaskCount` unless it is done. */
export const isOpen = (task: Task) => task.status !== 'done';
