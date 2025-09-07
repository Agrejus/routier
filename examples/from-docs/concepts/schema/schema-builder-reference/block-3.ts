// Available on all types
s.string().optional()
s.number().optional()
s.boolean().optional()
s.date().optional()
s.object({...}).optional()
s.array(s.string()).optional()