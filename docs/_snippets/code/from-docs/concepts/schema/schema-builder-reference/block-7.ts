// Available on all types
s.string().deserialize((str) => str.trim())
s.number().deserialize((str) => parseInt(str))
s.date().deserialize((str) => new Date(str))
s.boolean().deserialize((val) => Boolean(val))
s.object({...}).deserialize((str) => JSON.parse(str))
s.array(s.string()).deserialize((str) => str.split(","))