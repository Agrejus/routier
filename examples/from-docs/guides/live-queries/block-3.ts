// Live query with filtering - updates when filtered data changes
ctx.users
  .where((u) => u.isActive === true)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      console.log("Active users:", result.data);
    }
  });

// This will automatically update when:
// - New active users are added
// - Existing users become active/inactive
// - Active users are removed