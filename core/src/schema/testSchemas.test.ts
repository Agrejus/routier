import { uuidv4 } from "../utilities";
import { s } from "./builder";
import { CompiledSchema } from "./types";

declare const __brand: unique symbol;

export type UUID = string & { readonly [__brand]: 'UUID' };

const isNullOrEmpty = (value: unknown) => {
    return value == null || value == "";
}

export const optionalObjectSchemaFactory = () => s.define("optionalObject", {
    id: s.string().key(),
    user: s.object({
        name: s.string()
    }).optional(),
    content: s.string(),
    replies: s.number().default(0),
    createdAt: s.date().default(() => new Date()).deserialize(x => (typeof x === "object" && (x as unknown) instanceof Date) ? x : new Date(x))
}).compile();

export const usersSchemaOneFactory = () => s.define("usersOne", {
    id: s.string().constrain<UUID>().key().default(x => x.uuid() as UUID, { uuid: uuidv4 }),
    firstName: s.string(),
    lastName: s.string(),
    age: s.number(),
    createdDate: s.date().default(() => new Date("01/01/1900 8:00 AM")),
    address: s.object({
        street: s.string(),
        city: s.string(),
        state: s.string(),
        zip: s.string()
    })
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const usersSchemaTwoFactory = () => s.define("usersTwo", {
    id: s.string().key().default(x => x.uuid(), { uuid: uuidv4 }),
    firstName: s.string(),
    lastName: s.string(),
    age: s.number().constrain<1>(),
    createdDate: s.date().default(() => new Date("01/01/1900 8:00 AM")),
    address: s.object({
        street: s.string(),
        city: s.string(),
        state: s.object({
            id: s.string(),
            name: s.string(),
            abbreviation: s.string()
        }),
        zip: s.string()
    })
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const oneComputedPropertySchemaFactory = () => s.define("oneComputedProperty", {
    id: s.string().key().identity(),
    title: s.string(),
    authorId: s.string(),
    content: s.string(),
    tags: s.string().array(),
    isPublished: s.boolean(),
    publishedAt: s.date()
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const oneDefaultFunctionSchemaFactory = () => s.define("oneDefaultFunction", {
    id: s.string().key(),
    content: s.string(),
    replies: s.number().default(0),
    createdAt: s.date().default(() => new Date()).deserialize(x => (typeof x === "object" && (x as unknown) instanceof Date) ? x : new Date(x))
}).compile();

export const oneSerializeDeserializeSchemaFactory = () => s.define("oneSerializeDeserialize", {
    id: s.string().key(),
    content: s.string(),
    replies: s.number().default(0),
    createdAt: s.date().deserialize(x => (typeof x === "object" && (x as unknown) instanceof Date) ? x : new Date(x))
}).compile();

export const oneDefaultWithInjectionSchemaFactory = () => s.define("oneDefaultWithInjection", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    name: s.string().default(x => x.name, { name: "James" }),
    location: s.string().optional(),
    startTime: s.date(),
    endTime: s.date().optional(),
    description: s.string().optional(),
    isOnline: s.boolean()
}).compile();

export const remap = () => s.define("remapWithInjections", {
    id: s.string().key().from("_id").identity(),
    _rev: s.string().identity(),
    name: s.string().default(x => x.name, { name: "James" }),
    location: s.string().optional(),
    startTime: s.date().serialize(x => x.toISOString()).deserialize(x => new Date(x)),
    endTime: s.date().optional(),
    description: s.string().optional(),
    isOnline: s.boolean()
}).compile();

export const computedId = () => s.define("computedId", {
    name: s.string().default(x => x.name, { name: "James" }),
    location: s.string().optional(),
    startTime: s.date().serialize(x => x.toISOString()).deserialize(x => new Date(x)),
    endTime: s.date().optional(),
    description: s.string().optional(),
    isOnline: s.boolean()
}).modify(x => ({
    id: x.computed((_, c) => c).tracked().key()
})).compile();



export const computedAndFunctionPropertiesSchemaFactory = () => s.define("computedAndFunctionProperties", {
    sku: s.string().key().identity(),
    name: s.string(),
    quantity: s.number(),
    warehouseLocation: s.string().optional(),
    restockDate: s.date().optional(),
    discontinued: s.boolean()
}).modify(w => ({
    hasCollectionName: w.computed((_, collectionName, injected) => !injected.isNullOrEmpty(collectionName), { isNullOrEmpty }).tracked(),
    wasRestocked: w.function((x, _collectioNName, injected) => !injected.isNullOrEmpty(x.restockDate != null), { isNullOrEmpty }),
})).compile()

export const deeplyNestedSchemaFactory = () => s.define("deeplyNested", {
    id: s.string().key().default(x => x.uuid(), { uuid: uuidv4 }),
    firstName: s.string(),
    lastName: s.string(),
    age: s.number(),
    createdDate: s.date().default(() => new Date("01/01/1900 8:00 AM")),
    address: s.object({
        street: s.string(),
        city: s.string(),
        state: s.object({
            id: s.string(),
            name: s.string(),
            abbreviation: s.string()
        }),
        zip: s.string()
    })
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const complexOneSchemaFactory = () => s.define("complexOne", {
    id: s.string().key().default(x => x.uuid(), { uuid: uuidv4 }),
    firstName: s.string(),
    lastName: s.string(),
    age: s.number(),
    createdDate: s.date().default(() => new Date("01/01/1900 8:00 AM")),
    address: s.object({
        street: s.string(),
        city: s.string(),
        state: s.string(),
        zip: s.string()
    })
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const complexTwoSchemaFactory = () => s.define("complexTwo", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    firstName: s.string(),
    lastName: s.string(),
    email: s.string(),
    dateOfBirth: s.date(),
    address: s.object({
        street: s.string(),
        city: s.string(),
        state: s.string(),
        zipCode: s.string(),
        country: s.string()
    }),
    preferences: s.object({
        theme: s.string("light", "dark"),
        notifications: s.boolean(),
        language: s.string()
    }),
    lastLoginAt: s.date().optional(),
    createdAt: s.date().default(() => new Date())
}).modify(w => ({
    // Computed: Full name derived from first and last name
    fullName: w.computed(w => `${w.firstName} ${w.lastName}`),

    // Computed: Age calculated from date of birth
    age: w.computed(w => {
        const today = new Date();
        const birthDate = new Date(w.dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }),

    // Computed: Formatted address string
    formattedAddress: w.computed(w =>
        `${w.address.street}, ${w.address.city}, ${w.address.state} ${w.address.zipCode}, ${w.address.country}`
    ),

    // Computed: User status based on login activity 
    isActive: w.computed(w => {
        if (!w.lastLoginAt) return false;
        const daysSinceLogin = (Date.now() - w.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceLogin <= 30;
    }),

    // Function: Generate a display name with custom formatting
    getDisplayName: w.function(w => (format: 'short' | 'full') => {
        switch (format) {
            case 'short':
                return w.firstName;
            case 'full':
                return `${w.lastName}, ${w.firstName}`;
            default:
                return `${w.lastName}, ${w.firstName}`;
        }
    }),

    // Computed: Collection metadata (tracked so it saves to the underlying datastore)
    documentType: w.computed((_, collectionName) => collectionName).tracked()
})).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

export const arrayOfPrimitivesSchemaFactory = () => s.define("arrayOfPrimitives", {
    id: s.string().key(),
    tags: s.string().array(),
    scores: s.number().array(),
    flags: s.boolean().array(),
    dates: s.date().array()
}).compile();

export const arrayOfObjectsSchemaFactory = () => s.define("arrayOfObjects", {
    id: s.string().key(),
    items: s.object({
        name: s.string(),
        quantity: s.number(),
        price: s.number()
    }).array(),
    addresses: s.object({
        street: s.string(),
        city: s.string(),
        zip: s.string()
    }).array()
}).compile();

export const nestedArraySchemaFactory = () => s.define("nestedArray", {
    id: s.string().key(),
    matrix: s.array(s.number().array()),
    tags: s.array(s.string().array())
}).compile();

export const arrayInNestedObjectSchemaFactory = () => s.define("arrayInNestedObject", {
    id: s.string().key(),
    user: s.object({
        name: s.string(),
        tags: s.string().array(),
        preferences: s.object({
            colors: s.string().array(),
            sizes: s.number().array()
        })
    })
}).compile();

export const deeplyNestedWithArraysSchemaFactory = () => s.define("deeplyNestedWithArrays", {
    id: s.string().key(),
    company: s.object({
        name: s.string(),
        departments: s.object({
            name: s.string(),
            employees: s.object({
                name: s.string(),
                skills: s.string().array(),
                projects: s.object({
                    name: s.string(),
                    tags: s.string().array()
                }).array()
            }).array()
        }).array()
    })
}).compile();

export const nullableOptionalArraySchemaFactory = () => s.define("nullableOptionalArray", {
    id: s.string().key(),
    tags: s.string().array().optional(),
    scores: s.number().array().nullable(),
    items: s.object({
        name: s.string()
    }).array().optional()
}).compile();

export const arrayWithModifiersSchemaFactory = () => s.define("arrayWithModifiers", {
    id: s.string().key(),
    tags: s.string().array().default([]),
    items: s.object({
        name: s.string(),
        count: s.number().default(0)
    }).array().default([]),
    metadata: s.object({
        keys: s.string().array(),
        values: s.number().array()
    }).optional()
}).compile();

export const complexArrayNestingSchemaFactory = () => s.define("complexArrayNesting", {
    id: s.string().key(),
    posts: s.object({
        title: s.string(),
        comments: s.object({
            text: s.string(),
            likes: s.number().array(),
            replies: s.object({
                text: s.string(),
                tags: s.string().array()
            }).array()
        }).array(),
        tags: s.string().array()
    }).array()
}).compile();

export const factories: (() => CompiledSchema<any>)[] = [
    optionalObjectSchemaFactory,
    usersSchemaOneFactory,
    oneComputedPropertySchemaFactory,
    oneDefaultFunctionSchemaFactory,
    oneSerializeDeserializeSchemaFactory,
    oneDefaultWithInjectionSchemaFactory,
    computedAndFunctionPropertiesSchemaFactory,
    deeplyNestedSchemaFactory,
    complexOneSchemaFactory,
    complexTwoSchemaFactory,
    arrayOfPrimitivesSchemaFactory,
    arrayOfObjectsSchemaFactory,
    nestedArraySchemaFactory,
    arrayInNestedObjectSchemaFactory,
    deeplyNestedWithArraysSchemaFactory,
    nullableOptionalArraySchemaFactory,
    arrayWithModifiersSchemaFactory,
    complexArrayNestingSchemaFactory
]