const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://localhost:3000/myapp",
    live: true,
    retry: true,
    // Additional PouchDB sync options
    filter: (doc) => doc.type === "product",
    query_params: { user_id: "current_user" },
    since: "now",
    limit: 1000,
    include_docs: true,
    attachments: false,
    conflicts: true,
  },
});