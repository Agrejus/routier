// Available on all types
// Direct values
s.string().default("active")
s.number().default(0)
s.boolean().default(true)

// Function values (evaluated when needed)
s.date().default(() => new Date())
s.string().default(() => generateId())

// Complex defaults with functions
s.object({...}).default(() => ({ theme: "light" }))
s.array(s.string()).default(() => [])

// Dynamic defaults based on injected context
s.string().default((injected) => injected.currentUserId)