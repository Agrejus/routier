collection.where((entity) => entity.field === value);
collection.where(([entity, params]) => entity.field === params.value, {
  value,
});