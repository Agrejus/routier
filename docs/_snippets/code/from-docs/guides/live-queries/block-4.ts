// Live query with sorting - maintains sort order as data changes
ctx.users
  .sort((u) => u.name)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      console.log("Sorted users:", result.data);
    }
  });

// This will automatically update and maintain alphabetical order when:
// - New users are added
// - User names are updated
// - Users are removed