import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

const taskSchema = s.define("tasks", {
    id: s.string().key().identity(),
    title: s.string(),
    done: s.boolean(),
    createdAt: s.date(),
    tags: s.array(s.string()),
}).compile();

const openTaskSchema = s.define("openTasks", {
    id: s.string().key(),
    title: s.string(),
}).compile();

export class TaskStore extends DataStore {
    tasks = this.collection(taskSchema).proxy().create();

    openTasks = this.view(openTaskSchema)
        .derive(done =>
            this.tasks.subscribe().where(task => task.done === false).toArray(result => {
                if (result.ok === "success") {
                    done(result.data.map(task => ({ id: `open:${task.id}`, title: task.title })));
                }
            })
        )
        .create();

    constructor() {
        super(new MemoryPlugin("devtools-example"));
    }
}
