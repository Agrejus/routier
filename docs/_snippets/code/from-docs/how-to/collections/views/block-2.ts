productsView = this.view(productsViewSchema)
  .derive((done) => {
    return this.products.subscribe().toArray((response) => {
      if (response.ok === "error") {
        return done([]);
      }

      done(
        response.data.map((x) => ({
          id: `view:${x._id}`, // Predictable ID - view updates existing records
          name: x.name,
          price: x.price,
          // ... other fields
        }))
      );
    });
  })
  .create();