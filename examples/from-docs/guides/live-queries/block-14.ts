// Live query for unread notifications
ctx.notifications
  .where((n) => n.isRead === false)
  .orderByDescending((n) => n.createdAt)
  .subscribe()
  .toArray((result) => {
    if (result.ok === "success") {
      console.log("Unread notifications:", result.data);
    }
  });