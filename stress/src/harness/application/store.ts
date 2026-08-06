import { IDbPlugin } from '@routier/core';
import { DataStore } from '@routier/datastore';
import {
    activitySchema,
    attachmentSchema,
    commentSchema,
    membershipSchema,
    milestoneSchema,
    notificationSchema,
    organisationSchema,
    projectSchema,
    tagSchema,
    taskSchema,
    taskTagSchema,
    userSchema,
} from './schemas';

/**
 * Twelve collections in one datastore.
 *
 * The count is part of what is under test. A DataStore opens a BroadcastChannel pair per
 * collection at construction, and every save walks every collection's change tracker — costs
 * that no scenario has ever measured against anything but one or two collections. S6 happens
 * to construct eighteen and writes to exactly one of them.
 */
export class ApplicationStore extends DataStore {
    organisations = this.collection(organisationSchema).proxy().create();
    users = this.collection(userSchema).proxy().create();
    memberships = this.collection(membershipSchema).proxy().create();
    projects = this.collection(projectSchema).proxy().create();
    milestones = this.collection(milestoneSchema).proxy().create();
    tasks = this.collection(taskSchema).proxy().create();
    comments = this.collection(commentSchema).proxy().create();
    attachments = this.collection(attachmentSchema).proxy().create();
    tags = this.collection(tagSchema).proxy().create();
    taskTags = this.collection(taskTagSchema).proxy().create();
    activity = this.collection(activitySchema).proxy().create();
    notifications = this.collection(notificationSchema).proxy().create();

    constructor(plugin: IDbPlugin) {
        super(plugin);
    }
}

export const COLLECTION_COUNT = 12;
