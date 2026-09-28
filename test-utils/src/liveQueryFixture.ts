import { uuidv4 } from "@routier/core";
import { s, type InferType } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

export const liveTodoSchema = s.define("live_todos", {
    id: s.string().key().identity(),
    title: s.string(),
}).compile();

export type LiveTodo = InferType<typeof liveTodoSchema>;

export class LiveTodoStore extends DataStore {
    todos = this.collection(liveTodoSchema).proxy().create();
}

export const createLiveTodoStore = () => new LiveTodoStore(new MemoryPlugin(`live-${uuidv4()}`));

export const addTodo = async (store: LiveTodoStore, title: string) => {
    await store.todos.addAsync({ title });
    await store.saveChangesAsync();
};

export const waitUntil = (check: () => boolean, timeoutMs = 2000) => new Promise<void>((resolve, reject) => {
    const giveUpAt = Date.now() + timeoutMs;

    const poll = () => {
        if (check()) {
            resolve();
            return;
        }

        if (Date.now() >= giveUpAt) {
            reject(new Error(`waitUntil timed out after ${timeoutMs}ms`));
            return;
        }

        setTimeout(poll, 10);
    };

    poll();
});
