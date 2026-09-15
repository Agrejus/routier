import { useMemo, useState, type FormEvent } from "react";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { InferType, s } from "@routier/core/schema";
import { useQuery } from "@routier/react";

const todoSchema = s
  .define("todos", {
    id: s.string().key().identity(),
    title: s.string(),
    done: s.boolean().default(false),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

type Todo = InferType<typeof todoSchema>;

class TodoStore extends DataStore {
  todos = this.collection(todoSchema).proxy().create();

  constructor() {
    super(new MemoryPlugin("playground-react"));
  }
}

export function TodoApp() {
  // Memoize the store: a new DataStore on every render would resubscribe forever.
  const store = useMemo(() => new TodoStore(), []);
  const [title, setTitle] = useState("");

  // Both hooks re-render the component whenever a saved change affects their query.
  const todos = useQuery<Todo[]>(
    callback => store.todos.sort(t => t.createdAt).subscribe().toArray(callback),
    [store],
  );
  const remaining = useQuery<number>(
    callback => store.todos.where(t => t.done === false).subscribe().count(callback),
    [store],
  );

  const add = async (event: FormEvent) => {
    event.preventDefault();

    if (title.trim() === "") {
      return;
    }

    await store.todos.addAsync({ title: title.trim() });
    await store.saveChangesAsync();
    setTitle("");
  };

  const toggle = async (todo: Todo) => {
    todo.done = !todo.done;
    await store.saveChangesAsync();
  };

  const remove = async (todo: Todo) => {
    await store.todos.removeAsync(todo);
    await store.saveChangesAsync();
  };

  if (todos.status === "pending") return <p>Loading…</p>;
  if (todos.status === "error") return <p>Error: {todos.error.message}</p>;

  return (
    <div className="demo">
      <form onSubmit={add} className="demo-form">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs doing?" />
        <button type="submit">Add</button>
      </form>

      <ul className="demo-list">
        {todos.data.map(todo => (
          <li key={todo.id} className={todo.done ? "is-done" : undefined}>
            <label>
              <input type="checkbox" checked={todo.done} onChange={() => toggle(todo)} />
              <span>{todo.title}</span>
            </label>
            <button type="button" onClick={() => remove(todo)} aria-label={`Remove ${todo.title}`}>
              ✕
            </button>
          </li>
        ))}
      </ul>

      <p className="demo-footer">
        {todos.data.length === 0
          ? "No todos yet. Add one above."
          : `${remaining.status === "success" ? remaining.data : "…"} of ${todos.data.length} remaining`}
      </p>
    </div>
  );
}
