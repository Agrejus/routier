---
title: Why Schemas?
---

# Why Schemas?

Schemas are the foundation of Routier's data management system. This document explains why schemas are important and how they benefit your application.

## Quick Navigation

- [What Are Schemas?](#what-are-schemas)
- [Benefits of Using Schemas](#benefits-of-using-schemas)
- [Real-World Examples](#real-world-examples)
- [When Not to Use Schemas](#when-not-to-use-schemas)
- [Best Practices](#best-practices)
- [Conclusion](#conclusion)
- [Next Steps](#next-steps)

## What Are Schemas?

A schema is a blueprint that defines:

- **Structure** - What properties your data has
- **Types** - What kind of values each property can hold
- **Constraints** - Rules that data must follow
- **Behavior** - How properties should behave (computed, tracked, etc.)
- **Metadata** - Information for indexing, relationships, and more

## Benefits of Using Schemas

### 1. **Type Safety**

Schemas provide compile-time type checking and type safety:


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/type-safety-example.ts

### 2. **Type Safety and Constraints**

Schemas ensure data structure matches your defined types, reducing bugs and improving data quality:


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/constraints-example.ts

### 3. **Self-Documenting Code**

Schemas serve as living documentation of your data structures:


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/self-documenting-example.ts

### 4. **Automatic Features**

Schemas enable powerful features without additional code:


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/automatic-features-example.ts

### 5. **Consistent Data Handling**

Schemas ensure all parts of your application handle data the same way:


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/consistent-handling-example.ts

### 6. **Performance Optimization**

Schemas enable automatic performance optimizations:


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/performance-example.ts

### 7. **Change Tracking and History**

Schemas enable powerful change tracking features:


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/change-tracking-example.ts

### 8. **Serialization and Persistence**

Schemas handle data transformation automatically:


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/serialization-example.ts

## Real-World Examples

### E-commerce Application


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/ecommerce-example.ts

### User Management System


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/user-management-example.ts

## When Not to Use Schemas

While schemas are powerful, they're not always necessary:

### **Simple Data Structures**


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/simple-data-example.ts

### **Temporary Data**


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/temporary-data-example.ts

### **External API Responses**


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/external-api-example.ts

## Best Practices

### 1. **Start Simple**


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/start-simple-example.ts

### 2. **Check Structure Early**


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/check-structure-example.ts

### 3. **Use Computed Properties**


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/computed-properties-example.ts

### 4. **Leverage Type Inference**


<<< @/_snippets/code/from-docs/concepts/schema/why-schemas/type-inference-example.ts

## Conclusion

Schemas in Routier provide a powerful foundation for building robust, type-safe, and performant applications. They offer:

- **Type Safety** - Compile-time type checking and structure definition
- **Automatic Features** - Indexing, change tracking, computed properties
- **Consistency** - Uniform data handling across your application
- **Performance** - Automatic optimizations and efficient queries
- **Maintainability** - Self-documenting, living data definitions

By embracing schemas, you'll build applications that are more reliable, performant, and easier to maintain. The initial investment in defining schemas pays dividends throughout your application's lifecycle.

## Next Steps

- [Creating A Schema](/concepts/schema/creating-a-schema) - Learn how to create schemas
- [Property Types](/concepts/schema/property-types/README) - Explore available property types
- [Modifiers](/concepts/schema/modifiers/README) - Understand property modifiers
