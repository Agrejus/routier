combinedView = this.view(combinedViewSchema)
  .derive((done) => {
    let usersData: User[] = [];
    let postsData: Post[] = [];
    let subscriptionCount = 0;

    const checkAndCombine = () => {
      subscriptionCount++;
      if (subscriptionCount === 2) {
        // Combine users and posts
        done(combineUsersAndPosts(usersData, postsData));
      }
    };

    this.users.subscribe().toArray((response) => {
      if (response.ok === "success") {
        usersData = response.data;
      }
      checkAndCombine();
    });

    this.posts.subscribe().toArray((response) => {
      if (response.ok === "success") {
        postsData = response.data;
      }
      checkAndCombine();
    });
  })
  .create();