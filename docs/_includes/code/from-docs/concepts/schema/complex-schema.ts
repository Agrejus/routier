import { s } from "@routier/core/schema";

// Complex nested schema with relationships
const productSchema = s
    .define("products", {
        id: s.string().key().identity(),
        name: s.string(),
        price: s.number(),
        category: s.string(),
        tags: s.array(s.string()),
        metadata: s.object({
            description: s.string(),
            specifications: s.object({
                weight: s.number(),
                dimensions: s.object({
                    width: s.number(),
                    height: s.number(),
                    depth: s.number(),
                }),
            }),
        }),
        reviews: s.array(s.object({
            id: s.string(),
            rating: s.number(),
            comment: s.string(),
            author: s.string(),
        })),
    })
    .compile();
