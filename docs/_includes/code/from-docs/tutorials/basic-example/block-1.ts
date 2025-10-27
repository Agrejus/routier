import { DataStore } from "routier";
import { s } from "routier-core/schema";
import { MemoryPlugin } from "routier-plugin-memory";

// Define schemas
const userSchema = s
  .define("user", {
    id: s.string().key().identity(),
    name: s.string().index(),
    email: s.string(),
    age: s.number().optional(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

const postSchema = s
  .define("post", {
    id: s.string().key().identity(),
    title: s.string().index(),
    content: s.string(),
    authorId: s.string().index(),
    published: s.boolean().default(false),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

// Create application context
class BlogContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("blog-app"));
  }

  users = this.collection(userSchema).create();
  posts = this.collection(postSchema).create();
}

// Usage example
async function main() {
  const ctx = new BlogContext();

  // Create a user
  const [user] = await ctx.users.addAsync({
    name: "John Doe",
    email: "john@example.com",
    age: 30,
  });

  // Create posts for the user
  await ctx.posts.addAsync(
    {
      title: "My First Post",
      content: "Hello, world!",
      authorId: user.id,
      published: true,
    },
    {
      title: "Draft Post",
      content: "This is a draft...",
      authorId: user.id,
      published: false,
    }
  );

  // Save all changes
  await ctx.saveChangesAsync();

  // Query data
  const publishedPosts = await ctx.posts
    .where((post) => post.published)
    .toArrayAsync();

  const userPosts = await ctx.posts
    .where((post) => post.authorId === user.id)
    .sort((post) => post.createdAt)
    .toArrayAsync();

  console.log("Published posts:", publishedPosts);
  console.log("User posts:", userPosts);
}

main().catch(console.error);