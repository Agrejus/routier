// Available on all types
s.string().nullable()
s.number().nullable()
s.boolean().nullable()
s.date().nullable()
s.object({...}).nullable()
s.array(s.string()).nullable()