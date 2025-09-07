sync: {
  remoteDb: 'http://localhost:3000/myapp',
  live: true,
  retry: true,
  filter: (doc) => {
    // Only sync user's own data
    return doc.userId === currentUserId;
  }
}