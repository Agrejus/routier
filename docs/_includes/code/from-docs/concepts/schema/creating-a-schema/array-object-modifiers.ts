import { s } from "@routier/core/schema";

// Array and object modifiers
const companySchema = s.define("companies", {
    id: s.string().key().identity(),
    name: s.string(),
    address: s.object({
        street: s.string(),
        city: s.string(),
        zipCode: s.string(),
    }).optional(),
    departments: s.array(s.string()).default([]),
    employees: s.array(s.object({
        name: s.string(),
        role: s.string(),
        startDate: s.date(),
    })).optional(),
}).compile();
