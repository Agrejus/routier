// Available on all types
s.string().readonly()
s.number().readonly()
s.boolean().readonly()
s.date().readonly()
s.object({...}).readonly()
s.array(s.string()).readonly()