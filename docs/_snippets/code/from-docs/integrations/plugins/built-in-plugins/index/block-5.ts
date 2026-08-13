.modify(x => ({
  documentType: x.computed((_, collectionName) => collectionName).tracked()
}))