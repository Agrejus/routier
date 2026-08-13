// Pull-only sync
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  pull: { live: true },
  push: false
}

// Configure push options
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  push: {
    live: true,
    retry: true
  }
}