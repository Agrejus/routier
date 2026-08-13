import { s } from "@routier/core/schema";
import { v4 as uuidv4 } from 'uuid';

// Tracked computed properties within schemas
const productSchema = s.define("products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
    category: s.string(),
}).modify(w => ({
    // Computed property with tracking for indexing
    displayName: w.computed((entity, collectionName) =>
        `${entity.name} (${entity.category})`,
        {}
    ).tracked(),

    // Computed with injected dependencies
    slug: w.computed((entity, collectionName, injected) =>
        injected.slugify(entity.name),
        { slugify: (str: string) => str.toLowerCase().replace(/\s+/g, '-') }
    ).tracked(),
})).compile();
