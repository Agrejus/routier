productsView = this.view(productsViewSchema).mirror()
  .scope(([x, p]) => x.documentType === p.collectionName, productsViewSchema)
  .derive((done) => {
    // View logic here
  })
  .create();