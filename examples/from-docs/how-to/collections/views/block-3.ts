commentsView = this.view(commentsViewSchema)
  .derive((done) => {
    return this.comments.subscribe().toArray((response) => {
      if (response.ok === "error") {
        return done([]);
      }

      done(
        response.data.map((x) => ({
          id: `view:${x._id}`,
          content: x.content,
          user: {
            name: x.author, // Flattened structure
          },
          createdAt: new Date(),
          replies: x.replies,
        }))
      );
    });
  })
  .create();