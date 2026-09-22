# Devtools

A task list with `@routier/devtools` mounted. Open the drawer, pick a collection, and watch the
table, the counts, and an open row update as the buttons change the data.

## Run it

The example resolves the packages from `dist`. Build the repository first.

1. Build the packages.

   ```bash
   npm run build
   ```

2. Start the example.

   ```bash
   node_modules/.bin/vite examples/devtools
   ```

3. Open http://localhost:5230.

## What to try

| Do this | See this |
| --- | --- |
| **Add a task** | `tasks` and `openTasks` counts go up, and an open table gains a row. |
| **Complete the oldest open task** | The task's `done` flips in `tasks`, and it leaves the `openTasks` view. |
| **Add 120 tasks** | The table pages 50 rows at a time, and the burst renders without stutter. |
| Open a row, then complete it | The row detail updates in place. |
