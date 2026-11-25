import { s } from "@routier/core/schema";

const customerSchema = s.define("customers", {
    id: s.string().key().identity(),
    name: s.string(),
    taxId: s.string().sensitive(),
    phone: s.string().optional().sensitive(),
    card: s.object({
        number: s.string(),
        brand: s.string(),
    }).sensitive(),
}).compile();

const hidden = customerSchema.sensitiveProperties.map(property => property.id);
