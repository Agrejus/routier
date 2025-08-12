# Routier React Examples

This is a React application demonstrating how to use the Routier framework for data management in React applications.

## Features

- **User Management** - Create, read, and delete users
- **Post Management** - Create, read, and delete blog posts
- **Real-time Data** - Live updates using Routier's change tracking
- **TypeScript** - Full type safety with TypeScript
- **Modern React** - Built with React 18 and modern hooks

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run test:ui` - Run tests with UI
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── App.tsx          # Main application component
├── App.css          # Application styles
├── main.tsx         # React entry point
├── index.css        # Base styles
└── test/
    └── setup.ts     # Test configuration
```

## Routier Integration

This example demonstrates:

- **Schema Definition** - Using Routier's schema system
- **Data Context** - Extending DataStore for your application
- **Collections** - Creating and managing data collections
- **CRUD Operations** - Add, read, update, delete operations
- **Change Tracking** - Automatic change detection and persistence

## Key Concepts

### Schema Definition

```typescript
const userSchema = s
  .define("user", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    name: s.string().index(),
    email: s.string(),
    age: s.number().optional(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();
```

### Data Context

```typescript
class BlogContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("blog-app"));
  }

  users = this.collection(userSchema).create();
  posts = this.collection(postSchema).create();
}
```

### React Integration

```typescript
function App() {
  const [ctx] = useState(() => new BlogContext());
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const usersData = await ctx.users.toArrayAsync();
    setUsers(usersData);
  };
}
```

## Customization

You can easily customize this example by:

- Adding new schemas and collections
- Implementing different storage plugins
- Adding more complex queries and relationships
- Implementing real-time subscriptions
- Adding authentication and authorization

## Learn More

- [Routier Documentation](../docs/README.md)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

## Contributing

This is part of the Routier framework. See the main project for contribution guidelines.
