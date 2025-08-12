import React, { useState, useEffect } from 'react'
import { DataStore } from 'routier'
import { s } from 'routier-core/schema'
import { MemoryPlugin } from 'routier-plugin-memory'
import { LocalStoragePlugin } from 'routier-plugin-local-storage'
import './App.css'

// Define schemas
const userSchema = s
  .define("user", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    name: s.string().index(),
    email: s.string(),
    age: s.number().optional(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile()

const postSchema = s
  .define("post", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    title: s.string().index(),
    content: s.string(),
    authorId: s.string().index(),
    published: s.boolean().default(false),
    createdAt: s.date().default(() => new Date()),
  })
  .compile()

// Create application context
class BlogContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("blog-app"))
  }

  users = this.collection(userSchema).create()
  posts = this.collection(postSchema).create()
}

type User = typeof userSchema._type
type Post = typeof postSchema._type

function App() {
  const [ctx] = useState(() => new BlogContext())
  const [users, setUsers] = useState<User[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [newUser, setNewUser] = useState({ name: '', email: '', age: '' })
  const [newPost, setNewPost] = useState({ title: '', content: '', authorId: '' })

  // Load initial data
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [usersData, postsData] = await Promise.all([
        ctx.users.toArrayAsync(),
        ctx.posts.toArrayAsync()
      ])
      setUsers(usersData)
      setPosts(postsData)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const addUser = async () => {
    try {
      await ctx.users.addAsync({
        name: newUser.name,
        email: newUser.email,
        age: newUser.age ? parseInt(newUser.age) : undefined,
      })
      await ctx.saveChangesAsync()
      setNewUser({ name: '', email: '', age: '' })
      loadData()
    } catch (error) {
      console.error('Error adding user:', error)
    }
  }

  const addPost = async () => {
    try {
      await ctx.posts.addAsync({
        title: newPost.title,
        content: newPost.content,
        authorId: newPost.authorId,
      })
      await ctx.saveChangesAsync()
      setNewPost({ title: '', content: '', authorId: '' })
      loadData()
    } catch (error) {
      console.error('Error adding post:', error)
    }
  }

  const deleteUser = async (userId: string) => {
    try {
      const user = await ctx.users.firstOrUndefinedAsync(u => u._id === userId)
      if (user) {
        await ctx.users.removeAsync(user)
        await ctx.saveChangesAsync()
        loadData()
      }
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  const deletePost = async (postId: string) => {
    try {
      const post = await ctx.posts.firstOrUndefinedAsync(p => p._id === postId)
      if (post) {
        await ctx.posts.removeAsync(post)
        await ctx.saveChangesAsync()
        loadData()
      }
    } catch (error) {
      console.error('Error deleting post:', error)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Routier React Examples</h1>
        <p>Data management with React and Routier</p>
      </header>

      <main className="app-main">
        {/* Users Section */}
        <section className="section">
          <h2>Users</h2>
          
          <div className="form">
            <input
              type="text"
              placeholder="Name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />
            <input
              type="email"
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            <input
              type="number"
              placeholder="Age (optional)"
              value={newUser.age}
              onChange={(e) => setNewUser({ ...newUser, age: e.target.value })}
            />
            <button onClick={addUser}>Add User</button>
          </div>

          <div className="list">
            {users.map(user => (
              <div key={user._id} className="item">
                <div>
                  <strong>{user.name}</strong> ({user.email})
                  {user.age && ` - Age: ${user.age}`}
                </div>
                <button onClick={() => deleteUser(user._id)}>Delete</button>
              </div>
            ))}
          </div>
        </section>

        {/* Posts Section */}
        <section className="section">
          <h2>Posts</h2>
          
          <div className="form">
            <input
              type="text"
              placeholder="Title"
              value={newPost.title}
              onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
            />
            <textarea
              placeholder="Content"
              value={newPost.content}
              onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
            />
            <select
              value={newPost.authorId}
              onChange={(e) => setNewPost({ ...newPost, authorId: e.target.value })}
            >
              <option value="">Select Author</option>
              {users.map(user => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </select>
            <button onClick={addPost}>Add Post</button>
          </div>

          <div className="list">
            {posts.map(post => {
              const author = users.find(u => u._id === post.authorId)
              return (
                <div key={post._id} className="item">
                  <div>
                    <strong>{post.title}</strong>
                    <p>{post.content}</p>
                    <small>By: {author?.name || 'Unknown'} • {post.createdAt.toLocaleDateString()}</small>
                  </div>
                  <button onClick={() => deletePost(post._id)}>Delete</button>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
