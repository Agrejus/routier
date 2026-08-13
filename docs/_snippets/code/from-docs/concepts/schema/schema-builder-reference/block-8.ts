// Available on all types
s.string().serialize((str) => str.toLowerCase())
s.number().serialize((num) => Math.round(num))
s.date().serialize((date) => date.toISOString())
s.boolean().serialize((bool) => bool ? 1 : 0)
s.object({...}).serialize((obj) => JSON.stringify(obj))
s.array(s.string()).serialize((arr) => arr.join(","))