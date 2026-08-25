/**
 * A deliberately awkward app, for finding bugs rather than demonstrating features.
 *
 * What makes it awkward, and why each part is here:
 *
 *  - **Two related collections written in one save.** `bulkPersist` carries several schemas, the
 *    flush loops collections, and the pacer serializes per collection. Nothing else in the suite
 *    exercises more than one collection at a time.
 *  - **Five views over the same data, each a different query.** The SWR cache key is
 *    `schemaId|serialized-query`, so filtered, sorted and unfiltered views are separate cache
 *    entries over one store. A revalidate of one must not damage the others — a filtered GET
 *    returns a subset, and the store diff decides what to delete.
 *  - **Reads issued concurrently**, the way a real render does, to exercise request sharing.
 *  - **An audit** that compares local against the server field by field and reports drift, so a
 *    discrepancy is a visible number rather than something to eyeball in a table.
 */

import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { DexiePlugin } from '@routier/dexie-plugin';
import { HttpSwrDbPlugin, OptimisticUpdatesDbPlugin, type SyncOutcome } from '@routier/replication-plugin';

const projectSchema = s
    .define('projects', {
        _id: s.string().key().identity(),
        name: s.string(),
        status: s.string(),
        taskCount: s.number(),
    })
    .compile();

const taskSchema = s
    .define('tasks', {
        _id: s.string().key().identity(),
        projectId: s.string(),
        title: s.string(),
        done: s.boolean(),
        priority: s.number(),
    })
    .compile();

class WorkStore extends DataStore {
    projects = this.collection(projectSchema).proxy().create();
    tasks = this.collection(taskSchema).proxy().create();

}

const DB_NAME = 'complex-demo';
const QUEUE_DB_NAME = 'complex-demo-queue';

const log: string[] = [];
let store: WorkStore;
let swr: HttpSwrDbPlugin;
let lastSync: SyncOutcome | null = null;
let findings: string[] = [];

function note(message: string): void {
    log.unshift(`${new Date().toISOString().slice(11, 23)}  ${message}`);
}

function buildStore(): WorkStore {
    const localDb = new DexiePlugin(DB_NAME);
    swr = new HttpSwrDbPlugin(new OptimisticUpdatesDbPlugin(localDb), {
        getUrl: (collectionName) => `/api/${collectionName}`,
        unsyncedQueueStore: new DexiePlugin(QUEUE_DB_NAME),
        autoSync: { delayMs: 1_500 },
        maxAgeMs: 2_000,
        onSync: (outcome) => {
            lastSync = outcome;
            if (outcome.flushed > 0) note(`auto-sync delivered ${outcome.flushed} change(s)`);
            void render();
        },
        onSyncDeadLetter: (changes) => note(`DEAD-LETTERED ${changes.length}`),
        bulkPersistRetryMaxAttempts: 1,
    });
    return new WorkStore(swr);
}

// --- workload ---------------------------------------------------------------

const STATUSES = ['active', 'paused', 'done'];

/**
 * Seeds projects, then their tasks.
 *
 * Two saves, not one, and that is the point: an identity key is assigned by the store, so
 * `project._id` is not readable until the project has been saved. Reading it earlier gave every
 * task an undefined `projectId`, and the later lookup by owner found nothing — an app bug this
 * page produced on its first run, not a library one.
 */
async function seed(): Promise<void> {
    const started = performance.now();

    const projects = [];
    for (let p = 0; p < 3; p++) {
        const [project] = await store.projects.addAsync({
            name: `Project ${p + 1}`,
            status: STATUSES[p % STATUSES.length],
            taskCount: 0,
        } as never);
        projects.push(project);
    }

    // Save 1: the projects, so their identities exist
    await store.saveChangesAsync();

    for (const project of projects) {
        for (let t = 0; t < 4; t++) {
            await store.tasks.addAsync({
                projectId: project._id,
                title: `${project.name} task ${t + 1}`,
                done: t % 3 === 0,
                priority: (t % 3) + 1,
            } as never);
        }

        // Mutating a row that is no longer pending — an ordinary tracked update. The same line on
        // a row that WAS still pending threw `Cannot find internal addition` until defect #25 was
        // fixed, which is what this page found.
        project.taskCount = 4;
    }

    // Save 2: tasks plus the project updates — two collections in one save
    await store.saveChangesAsync();

    note(`seeded 3 projects and 12 tasks (${(performance.now() - started).toFixed(0)}ms)`);
    await render();
}

/** Every view at once, the way a first paint does. */
async function readAllViews() {
    return Promise.all([
        store.projects.toArrayAsync(),
        store.tasks.toArrayAsync(),
        store.tasks.where((t) => t.done === false).toArrayAsync(),
        store.tasks.where((t) => t.priority > 1).sort((t) => t.title).toArrayAsync(),
        store.projects.where((p) => p.status === 'active').toArrayAsync(),
    ]);
}

async function loadViews(): Promise<void> {
    const before = await requestCount();
    const [projects, tasks, open, byPriority, active] = await readAllViews();
    const after = await requestCount();

    note(`5 views: ${projects.length} projects, ${tasks.length} tasks, ${open.length} open, `
        + `${byPriority.length} priority>1, ${active.length} active — ${after - before} request(s)`);
    await render();
}

/** Interleaved edits across both collections, the shape a busy user produces. */
async function churn(): Promise<void> {
    const tasks = await store.tasks.toArrayAsync();
    const projects = await store.projects.toArrayAsync();
    if (tasks.length === 0 || projects.length === 0) return note('seed first');

    // toggle some tasks
    for (let i = 0; i < tasks.length; i += 3) {
        const task = await store.tasks.firstAsync((t) => t._id === tasks[i]._id);
        task.done = !task.done;
    }
    // rename a project
    const project = await store.projects.firstAsync((p) => p._id === projects[0]._id);
    project.name = `${project.name}*`;
    // delete one task and fix the count
    const victim = tasks[tasks.length - 1];
    await store.tasks.removeAsync(victim as never);
    const owner = await store.projects.firstAsync((p) => p._id === victim.projectId);
    owner.taskCount = Math.max(0, owner.taskCount - 1);

    await store.saveChangesAsync();
    note('churn: toggles + rename + delete across both collections in one save');
    await render();
}

async function reloadStore(): Promise<void> {
    store[Symbol.dispose]();
    store = buildStore();
    const [projects, tasks] = await Promise.all([store.projects.toArrayAsync(), store.tasks.toArrayAsync()]);
    note(`reloaded from IndexedDB: ${projects.length} projects, ${tasks.length} tasks`);
    await render();
}

async function toggleServer(): Promise<void> {
    const { serverDown } = await fetch('/_toggle').then((r) => r.json());
    note(`API is ${serverDown ? 'DOWN' : 'UP'}`);
    await render();
}

async function syncNow(): Promise<void> {
    const outcome = await swr.syncNow();
    lastSync = outcome;
    note(`syncNow → flushed ${outcome.flushed}, failed ${outcome.failed}, dead ${outcome.deadLettered}`);
    await render();
}

async function resetAll(): Promise<void> {
    await fetch('/_reset');
    store[Symbol.dispose]();
    for (const name of [DB_NAME, QUEUE_DB_NAME]) {
        await new Promise<void>((resolve) => { indexedDB.deleteDatabase(name).onsuccess = () => resolve(); });
    }
    store = buildStore();
    log.length = 0;
    findings = [];
    lastSync = null;
    note('reset');
    await render();
}

// --- the audit --------------------------------------------------------------

interface ServerState {
    rows: Array<Record<string, unknown>>;
    counts: Record<string, number>;
    requestLog: string[];
    serverDown: boolean;
}

function serverState(collection: string): Promise<ServerState> {
    return fetch(`/_state?collection=${collection}`).then((r) => r.json());
}

async function requestCount(): Promise<number> {
    return (await serverState('projects')).requestLog.length;
}

/**
 * Compares local against the server row by row and field by field. Only meaningful once the
 * queue has drained — anything still pending is expected drift, not a defect.
 */
async function audit(): Promise<void> {
    findings = [];
    const pending = await swr.pendingCount();
    const dead = (await swr.deadLetters()).length;

    for (const [, schema] of store.schemas) {
        const name = schema.collectionName;
        const local = await store.getCollection(schema).toArrayAsync() as Array<Record<string, unknown>>;
        const remote = (await serverState(name)).rows;
        const remoteById = new Map(remote.map((r) => [String(r._id), r]));

        if (local.length !== remote.length) {
            findings.push(`${name}: ${local.length} local vs ${remote.length} on the server`);
        }

        for (const row of local) {
            const match = remoteById.get(String(row._id));
            if (match == null) {
                findings.push(`${name}: ${String(row._id).slice(0, 8)} missing on the server`);
                continue;
            }
            for (const [key, value] of Object.entries(row)) {
                if (JSON.stringify(match[key]) !== JSON.stringify(value)) {
                    findings.push(`${name}.${key} differs for ${String(row._id).slice(0, 8)}: local ${JSON.stringify(value)} vs server ${JSON.stringify(match[key])}`);
                }
            }
            remoteById.delete(String(row._id));
        }

        for (const orphan of remoteById.keys()) {
            findings.push(`${name}: ${orphan.slice(0, 8)} on the server but not local`);
        }
    }

    const verdict = findings.length === 0
        ? `audit clean (pending ${pending}, dead ${dead})`
        : `audit found ${findings.length} discrepanc${findings.length === 1 ? 'y' : 'ies'} (pending ${pending}, dead ${dead})`;
    note(verdict);
    await render();
}

/** Waits for the queue to drain, then audits — the check that should always pass. */
async function settleAndAudit(): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (await swr.pendingCount() > 0) {
        if (Date.now() > deadline) {
            note('queue did not drain within 15s');
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await audit();
}

// --- rendering --------------------------------------------------------------

function table(rows: Array<Record<string, unknown>>, columns: string[]): string {
    if (rows.length === 0) return '<p class="empty">no rows</p>';
    return `<table><thead><tr>${columns.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows
        .map((r) => `<tr>${columns.map((c) => `<td>${c === '_id' ? String(r[c]).slice(0, 6) : String(r[c])}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`;
}

async function render(): Promise<void> {
    const [projects, tasks, open, byPriority, active] = await readAllViews();
    const serverProjects = await serverState('projects');
    const serverTasks = await serverState('tasks');
    const pending = await swr.pendingCount();

    document.getElementById('status')!.className = serverProjects.serverDown ? 'status down' : 'status up';
    document.getElementById('status')!.textContent = serverProjects.serverDown ? 'API: DOWN' : 'API: UP';
    (document.getElementById('toggle') as HTMLButtonElement).textContent =
        serverProjects.serverDown ? 'Bring the API back' : 'Take the API down';

    const badge = document.getElementById('queue')!;
    badge.textContent = `${pending} pending`;
    badge.className = pending === 0 ? 'tag ok' : 'tag warn';
    document.getElementById('last-sync')!.textContent = lastSync == null
        ? '—'
        : `flushed ${lastSync.flushed}, failed ${lastSync.failed}, dead ${lastSync.deadLettered}`;

    document.getElementById('projects')!.innerHTML = table(projects as never, ['name', 'status', 'taskCount', '_id']);
    document.getElementById('tasks')!.innerHTML = table(tasks.slice(0, 8) as never, ['title', 'done', 'priority', '_id']);
    document.getElementById('views')!.innerHTML = [
        `all projects: <b>${projects.length}</b>`,
        `all tasks: <b>${tasks.length}</b>`,
        `open tasks: <b>${open.length}</b>`,
        `priority &gt; 1, sorted: <b>${byPriority.length}</b>`,
        `active projects: <b>${active.length}</b>`,
        `server: <b>${serverProjects.counts.projects ?? 0}</b> projects, <b>${serverTasks.counts.tasks ?? 0}</b> tasks`,
    ].join('<br />');

    const auditEl = document.getElementById('audit')!;
    auditEl.textContent = findings.length === 0 ? 'no discrepancies recorded' : findings.join('\n');
    auditEl.className = findings.length === 0 ? 'ok-text' : 'bad-text';

    document.getElementById('log')!.textContent = log.slice(0, 12).join('\n');
    document.getElementById('requests')!.textContent = serverProjects.requestLog.slice(-12).reverse().join('\n');
}

async function main(): Promise<void> {
    store = buildStore();

    const bind = (id: string, handler: () => Promise<void>) => {
        document.getElementById(id)!.addEventListener('click', () => {
            handler().catch((err) => { note(`ERROR ${String(err)}`); void render(); });
        });
    };

    bind('seed', seed);
    bind('views-btn', loadViews);
    bind('churn', churn);
    bind('reload', reloadStore);
    bind('sync', syncNow);
    bind('toggle', toggleServer);
    bind('audit-btn', settleAndAudit);
    bind('reset', resetAll);

    note('ready');
    await render();
}

void main();
