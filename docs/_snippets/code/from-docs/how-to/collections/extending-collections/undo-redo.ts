import { Collection, DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";
import type { InferRoot, InferType } from "@routier/core/schema";

const taskSchema = s
    .define("tasks", {
        id: s.string().key(),
        title: s.string(),
        done: s.boolean(),
    })
    .compile();

type Task = InferType<typeof taskSchema>;

type Edit = { task: Task; before: Task; after: Task };

class TaskCollection extends Collection<InferRoot<typeof taskSchema>> {
    private undoStack: Edit[] = [];
    private redoStack: Edit[] = [];

    edit(task: Task, change: Partial<Task>): void {
        const before = { ...task };

        Object.assign(task, change);
        this.undoStack.push({ task, before, after: { ...task } });
        this.redoStack = [];
    }

    undo(): boolean {
        const last = this.undoStack.pop();

        if (last == null) {
            return false;
        }

        Object.assign(last.task, last.before);
        this.redoStack.push(last);
        return true;
    }

    redo(): boolean {
        const next = this.redoStack.pop();

        if (next == null) {
            return false;
        }

        Object.assign(next.task, next.after);
        this.undoStack.push(next);
        return true;
    }
}

class AppDataStore extends DataStore {
    tasks: TaskCollection = this.collection(taskSchema).proxy().create((_, dependencies) => new TaskCollection(dependencies));

    constructor() {
        super(new MemoryPlugin("app"));
    }
}

const ctx = new AppDataStore();
const [task] = await ctx.tasks.addAsync({ id: "t1", title: "Write docs", done: false });
await ctx.saveChangesAsync();

ctx.tasks.edit(task, { done: true });
await ctx.saveChangesAsync();

ctx.tasks.undo();
await ctx.saveChangesAsync();

ctx.tasks.redo();
await ctx.saveChangesAsync();
