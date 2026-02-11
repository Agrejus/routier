// Inside map() - deserialization happens automatically
for (const field of option.value.fields) {
  if (field.property != null) {
    const value = field.property.getValue(data[i]);
    if (value != null) {
      // Property's deserialize() method is called here
      field.property.setValue(data[i], field.property.deserialize(value));
    }
  }
}