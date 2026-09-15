import { useMemo, useState, type FormEvent } from "react";
import { DataStore } from "@routier/datastore";
import { DexiePlugin } from "@routier/dexie-plugin";
import { InferType, s } from "@routier/core/schema";
import { useQuery } from "@routier/react";

const noteSchema = s
  .define("notes", {
    id: s.string().key().identity(),
    text: s.string(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

type Note = InferType<typeof noteSchema>;

class NotesStore extends DataStore {
  notes = this.collection(noteSchema).proxy().create();

  constructor() {
    // IndexedDB through Dexie, so notes survive a page reload.
    // Swap in `new MemoryPlugin("notes")` and nothing else in this file changes.
    super(new DexiePlugin("routier-playground-notes"));
  }
}

export function NotesApp() {
  const store = useMemo(() => new NotesStore(), []);
  const [text, setText] = useState("");

  const notes = useQuery<Note[]>(
    callback => store.notes.sortDescending(n => n.createdAt).subscribe().toArray(callback),
    [store],
  );

  const add = async (event: FormEvent) => {
    event.preventDefault();

    if (text.trim() === "") {
      return;
    }

    await store.notes.addAsync({ text: text.trim() });
    await store.saveChangesAsync();
    setText("");
  };

  const remove = async (note: Note) => {
    await store.notes.removeAsync(note);
    await store.saveChangesAsync();
  };

  const clear = async () => {
    const all = await store.notes.toArrayAsync();
    await store.notes.removeAsync(...all);
    await store.saveChangesAsync();
  };

  if (notes.status === "pending") return <p>Opening IndexedDB…</p>;
  if (notes.status === "error") return <p>Error: {notes.error.message}</p>;

  return (
    <div className="demo">
      <form onSubmit={add} className="demo-form">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Write a note, then reload the page" />
        <button type="submit">Save</button>
      </form>

      <ul className="demo-list">
        {notes.data.map(note => (
          <li key={note.id}>
            <span>
              {note.text}
              <small>{new Date(note.createdAt).toLocaleString()}</small>
            </span>
            <button type="button" onClick={() => remove(note)} aria-label="Remove note">
              ✕
            </button>
          </li>
        ))}
      </ul>

      <p className="demo-footer">
        {notes.data.length} note(s) stored in IndexedDB.{" "}
        {notes.data.length > 0 && (
          <button type="button" className="link-button" onClick={clear}>
            Clear all
          </button>
        )}
      </p>
    </div>
  );
}
