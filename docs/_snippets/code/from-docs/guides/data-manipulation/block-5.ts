// ✅ This works - replaces the entire array
user.preferences = ["dark-theme", "notifications", "analytics"];

// ❌ This doesn't work - doesn't track individual array mutations
// user.orders.pop(); // Not tracked
// user.orders[5] = newOrder; // Not tracked

// ✅ Instead, replace the array
user.orders = [...user.orders.slice(0, 5), newOrder, ...user.orders.slice(6)];