import { DataStore } from "@routier/datastore";
import { PGliteDbPlugin } from "@routier/pglite-plugin";
import { s } from "@routier/core/schema";
import { showInDevtools } from "../devtools";

type Log = (message: string, value?: unknown) => void;

const bookSchema = s
  .define("books", {
    id: s.string().key().identity(),
    title: s.string(),
    author: s.string(),
    year: s.number(),
  })
  .compile();

class LibraryStore extends DataStore {
  books = this.collection(bookSchema).proxy().create();

  constructor() {
    super(new PGliteDbPlugin(`memory://playground-library-${Date.now()}`));
  }
}

export async function run(log: Log) {
  log("Starting PostgreSQL in your browser. The first run takes a few seconds.");

  const store = new LibraryStore();
  showInDevtools(store, "PGlite");

  await store.books.addAsync(
    { title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", year: 1969 },
    { title: "A Wizard of Earthsea", author: "Ursula K. Le Guin", year: 1968 },
    { title: "Kindred", author: "Octavia E. Butler", year: 1979 },
    { title: "Parable of the Sower", author: "Octavia E. Butler", year: 1993 },
  );
  await store.saveChangesAsync();

  const seventies = await store.books
    .where(([b, p]) => b.year >= p.from && b.year < p.to, { from: 1970, to: 1980 })
    .toArrayAsync();
  log("Published in the 1970s", seventies.map(b => `${b.title} (${b.year})`));

  const byAuthor = await store.books.where(b => b.author.startsWith("Ursula")).sort(b => b.year).toArrayAsync();
  log("Le Guin, oldest first", byAuthor.map(b => b.title));
}
