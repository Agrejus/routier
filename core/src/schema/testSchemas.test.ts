import { uuidv4 } from "../utilities";
import { s } from "./builder";

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

export const usersSchemaTwoFactory = () => s.define("usersTwo", {
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

export const factories = [
    optionalObjectSchemaFactory,
    usersSchemaOneFactory,
    oneComputedPropertySchemaFactory,
    oneDefaultFunctionSchemaFactory,
    oneSerializeDeserializeSchemaFactory,
    oneDefaultWithInjectionSchemaFactory,
    computedAndFunctionPropertiesSchemaFactory,
    deeplyNestedSchemaFactory,
    complexOneSchemaFactory,
    complexTwoSchemaFactory
]