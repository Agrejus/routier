import { DataStore } from "@routier/datastore";
import { DexiePlugin } from "@routier/dexie-plugin";
import { InferType, s } from "@routier/core/schema";

const DATABASE = "todo-app";
const DATABASE_VERSION = 2;
const SCHEMA_VERSION = 2;

const todoV1 = s
    .define("todos", {
        id: s.string().key().identity(),
        title: s.string(),
        done: s.boolean(),
    })
    .compile();

const todoV2 = s
    .define("todos", {
        id: s.string().key().identity(),
        title: s.string(),
        status: s.string("open", "done").default("open"),
        schemaVersion: s.number().default(SCHEMA_VERSION),
    })
    .compile();

type TodoV1 = InferType<typeof todoV1>;
type TodoV2 = InferType<typeof todoV2>;

class LegacyTodoStore extends DataStore {
    todos = this.collection(todoV1).proxy().create();

    constructor() {
        super(new DexiePlugin(DATABASE, { version: DATABASE_VERSION }));
    }
}

export class TodoStore extends DataStore {
    todos = this.collection(todoV2).proxy().create();

    constructor() {
        super(new DexiePlugin(DATABASE, { version: DATABASE_VERSION }));
    }
}

const upgradeTodo = (before: TodoV1): Pick<TodoV2, "status" | "schemaVersion"> => ({
    status: before.done ? "done" : "open",
    schemaVersion: SCHEMA_VERSION,
});

const readLegacyTodos = async () => {
    const legacy = new LegacyTodoStore();

    try {
        const todos = await legacy.todos.toArrayAsync();

        return new Map(todos.map((todo) => [todo.id, todo]));
    } finally {
        legacy[Symbol.dispose]();
    }
};

export const migrateTodos = async (store: TodoStore) => {
    const pending = await store.todos
        .where(([t, p]) => t.schemaVersion == null || t.schemaVersion < p.current, { current: SCHEMA_VERSION })
        .toArrayAsync();

    if (pending.length === 0) {
        return 0;
    }

    const before = await readLegacyTodos();

    for (const todo of pending) {
        const legacy = before.get(todo.id);

        if (legacy != null) {
            Object.assign(todo, upgradeTodo(legacy));
        }

        store.todos.attachments.markDirty(todo);
    }

    await store.saveChangesAsync();

    return pending.length;
};
