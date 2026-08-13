import { s } from "@routier/core/schema";

// E-commerce application schema example
const ecommerceSchema = s.define("ecommerce", {
    // Products
    products: s.object({
        id: s.string().key().identity(),
        name: s.string(),
        description: s.string().optional(),
        price: s.number(),
        category: s.string("electronics", "books", "clothing", "home"),
        sku: s.string().distinct(),
        inStock: s.boolean().default(true),
        tags: s.array(s.string()).default([]),
    }),

    // Orders
    orders: s.object({
        id: s.string().key().identity(),
        customerId: s.string().index("customer_orders"),
        items: s.array(s.object({
            productId: s.string(),
            quantity: s.number(),
            price: s.number(),
        })),
        status: s.string("pending", "processing", "shipped", "delivered", "cancelled"),
        total: s.number(),
        createdAt: s.date().default(() => new Date()),
    }),

    // Customers
    customers: s.object({
        id: s.string().key().identity(),
        email: s.string().distinct(),
        name: s.string(),
        address: s.object({
            street: s.string(),
            city: s.string(),
            zipCode: s.string(),
            country: s.string(),
        }).optional(),
        preferences: s.object({
            newsletter: s.boolean().default(false),
            language: s.string("en", "es", "fr").default("en"),
        }).default({}),
    }),
}).compile();

// This schema provides:
// - Type safety for all e-commerce data
// - Automatic indexing for fast queries
// - Constraint enforcement (unique SKUs, emails)
// - Default values and computed properties
// - Consistent data handling across the application
