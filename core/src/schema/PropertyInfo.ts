import { SchemaBase } from './property/base/SchemaBase';
import { SchemaArray } from './property/types/SchemaArray';
import { DefaultValue, FunctionBody, PropertyDeserializer, PropertySerializer, SchemaTypes } from './types';

/**
 * Represents metadata and utilities for a property in a schema, including its type, name, parent, children, and serialization details.
 */
export class PropertyInfo<T extends {}> {

    get id() {
        if (this._idCache) {
            return this._idCache;
        }
        this._idCache = this.getPathArray().join(".");
        return this._idCache;
    }

    /** The name of the property. */
    readonly name: string;
    /** The name of the property we need to map from. */
    readonly from: string | null = null;
    /** The schema type of the property. */
    readonly type: SchemaTypes;

    /** Whether the property can be null. */
    readonly isNullable: boolean;
    /** Whether the property is optional. */
    readonly isOptional: boolean;
    /** Whether the property is a key. */
    readonly isKey: boolean;
    /** Whether the property is an identity property. */
    readonly isIdentity: boolean;
    /** Whether the property is readonly. */
    readonly isReadonly: boolean;
    /** Whether the property is unmapped. */
    readonly isUnmapped: boolean;
    /** Whether the property is distinct. */
    readonly isDistinct: boolean;
    /** Indexes associated with the property. */
    readonly indexes: string[];

    /** Any injected value for the property. */
    readonly injected: any | null = null;
    /** The default value for the property, if any. */
    readonly defaultValue: DefaultValue<any> | null = null;
    /** Serializer for the property value, if any. */
    readonly valueSerializer: PropertySerializer<T> | null = null;
    /** Deserializer for the property value, if any. */
    readonly valueDeserializer: PropertyDeserializer<T> | null = null;
    /** Function body for computed properties, if any. */
    readonly functionBody: FunctionBody<any, T> | null;
    /** Child properties of this property. */
    readonly children: PropertyInfo<T>[] = [];
    /** The schema this property belongs to. */
    readonly schema: SchemaBase<T, any>;
    /** The inner schema if this property is an array. */
    readonly innerSchema?: SchemaBase<unknown, any>;
    /** Literal values allowed for this property. */
    readonly literals: T[];

    /** The parent property, if any. */
    readonly parent?: PropertyInfo<T>;

    // Cached computed values for performance
    private _propertyChainCache?: PropertyInfo<T>[];
    private _pathArrayCache?: string[];
    private _parentPathArrayCache?: string[];
    private _idCache?: string;
    private _levelCache?: number;
    private _hasNullableParentsCache?: boolean;

    constructor(schema: SchemaBase<T, any>, name: string, parent?: PropertyInfo<T> | null) {
        this.schema = schema;
        this.name = name;
        this.type = schema.type;
        this.literals = schema.literals;

        if (schema instanceof SchemaArray) {
            this.innerSchema = schema.innerSchema;
        }

        this.isNullable = schema.isNullable;
        this.isOptional = schema.isOptional;
        this.isKey = schema.isKey;
        this.isIdentity = schema.isIdentity;
        this.isReadonly = schema.isReadonly;
        this.isUnmapped = schema.isUnmapped;
        this.injected = schema.injected;
        this.isDistinct = schema.isDistict;
        this.indexes = schema.indexes;
        this.from = schema.fromPropertyName;

        this.defaultValue = schema.defaultValue;
        this.valueSerializer = schema.valueSerializer;
        this.valueDeserializer = schema.valueDeserializer;
        this.functionBody = schema.functionBody;

        this.parent = parent;
    }

    /**
     * Returns the depth (level) of this property in the property tree.
     *
     * The root property has a level of 0. Each child property increases the level by 1.
     * Traverses up the parent chain, incrementing the level for each parent until the root is reached.
     * 
     * @returns {number} The number of parent properties above this property (0 for root).
     */
    get level() {
        if (this._levelCache !== undefined) {
            return this._levelCache;
        }

        let level = 0;
        let current: PropertyInfo<T> | undefined = this;

        while (current) {
            if (current.parent == null) {
                this._levelCache = level;
                return level;
            }

            current = current.parent;
            level++;
        }

        this._levelCache = level;
        return level;
    }

    private _getPropertyChain(): PropertyInfo<T>[] {
        if (this._propertyChainCache) {
            return this._propertyChainCache;
        }

        const chain: PropertyInfo<T>[] = [];
        let current: PropertyInfo<T> | undefined = this;

        while (current) {
            chain.unshift(current);
            current = current.parent;
        }

        this._propertyChainCache = chain;
        return chain;
    }

    private _needsOptionalChaining(prop: PropertyInfo<T>, assignmentType?: AssignmentType): boolean {
        if (assignmentType === "ASSIGNMENT") {
            return false;
        }

        return assignmentType === "FORCE_NULLABLE_OR_OPTIONAL" || prop.isNullable || prop.isOptional;
    }

    private _resolvePathArray(options?: {
        root?: string,
        assignmentType?: AssignmentType
        useFromPropertyName?: boolean
    }) {
        const propertyChain = this._getPropertyChain();
        const hasRoot = options?.root != null;
        const path: string[] = hasRoot ? [options!.root!] : [];

        for (const prop of propertyChain) {
            const accessor = this._needsOptionalChaining(prop, options?.assignmentType) ? '?.' : '.';
            path.push(accessor, options?.useFromPropertyName ? prop.from : prop.name);
        }

        return path;
    }

    /**
     * Returns an array of property names representing the path from the root to this property.
     *
     * @returns {string[]} The property path as an array of names.
     */
    getPathArray() {
        if (this._pathArrayCache) {
            return this._pathArrayCache;
        }

        const path: string[] = [];
        const propertyChain = this._getPropertyChain();

        for (const prop of propertyChain) {
            path.push(prop.name);
        }

        this._pathArrayCache = path;
        return path;
    }

    /**
     * Returns an array of property names representing the path from the root to the parent of this property.
     *
     * @returns {string[]} The property path as an array of names, excluding this property.
     */
    getParentPathArray() {
        if (this._parentPathArrayCache) {
            return this._parentPathArrayCache;
        }

        const path: string[] = [];
        const propertyChain = this._getPropertyChain();

        for (let i = 0; i < propertyChain.length - 1; i++) {
            const prop = propertyChain[i];
            path.push(prop.name);
        }

        this._parentPathArrayCache = path;
        return path;
    }

    /**
     * Returns true if any parent property is nullable or optional.
     *
     * @returns {boolean} True if any parent is nullable or optional, false otherwise.
     */
    get hasNullableParents() {
        if (this._hasNullableParentsCache !== undefined) {
            return this._hasNullableParentsCache;
        }

        let parent = this.parent;
        while (parent != null) {
            if (parent.isNullable || parent.isOptional) {
                this._hasNullableParentsCache = true;
                return true;
            }
            parent = parent.parent;
        }

        this._hasNullableParentsCache = false;
        return false;
    }

    /**
     * Returns true if any child property (recursively) is an identity property.
     *
     * @returns {boolean} True if any child is an identity property, false otherwise.
     */
    get hasIdentityChildren() {
        const children = [...this.children];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.isIdentity === true) {
                return true;
            }
            if (child.children.length > 0) {
                children.push(...child.children)
            }
        }
        return false;
    }

    /**
     * Gets the value of this property from the given instance, following the property path.
     *
     * @param instance The object instance to retrieve the value from.
     * @returns The value of the property, or null if not found.
     */
    getValue(instance: unknown) {
        if (instance == null) {
            return null;
        }
        const pathArray = this.getPathArray();
        let current: any = instance;
        for (const prop of pathArray) {
            if (current == null) {
                return null;
            }
            current = current[prop];
        }
        return current;
    }

    /**
     * Sets the value of this property on the given instance, creating intermediate objects as needed.
     *
     * @param instance The object instance to set the value on.
     * @param value The value to set.
     */
    setValue(instance: unknown, value: unknown) {
        if (instance == null) {
            throw new Error('Cannot set value on null or undefined instance');
        }
        const pathArray = this.getPathArray();
        const length = pathArray.length;
        // Fast path for single level properties
        if (length === 1) {
            (instance as any)[pathArray[0]] = value;
            return;
        }
        let current: any = instance;
        let i = 0;
        // Navigate to the parent of the target property
        while (i < length - 1) {
            const prop = pathArray[i];
            const next = current[prop];
            // Only create new object if next level doesn't exist
            if (next == null) {
                current[prop] = {};
            }
            current = current[prop];
            i++;
        }
        // Set the value on the final property
        current[pathArray[length - 1]] = value;
    }

    /**
     * Returns a selector path string for this property, starting from the given parent variable name.
     *
     * @param options.parent The root variable name.
     * @param options.assignmentType Optional assignment type for path resolution.
     * @returns {string} The selector path string (e.g., 'parent.prop1.prop2').
     */
    getSelectrorPath(options: { parent: string, assignmentType?: AssignmentType, useFromPropertyName?: boolean }) {
        const parts = this._resolvePathArray({
            root: options.parent,
            assignmentType: options.assignmentType,
            useFromPropertyName: options.useFromPropertyName
        });
        return parts.join("");
    }

    /**
     * Returns an assignment path string for this property, optionally starting from a parent variable name.
     *
     * @param options.parent Optional root variable name.
     * @returns {string} The assignment path string (e.g., 'prop1.prop2').
     */
    getAssignmentPath(options?: { parent?: string, useFromPropertyName?: boolean }) {
        const parts = this._resolvePathArray({
            root: options?.parent,
            assignmentType: "ASSIGNMENT",
            useFromPropertyName: options?.useFromPropertyName
        });

        if (options?.parent == null) {
            return parts.slice(1).join("");
        }

        return parts.join("");
    }

    deserialize(value: string | number) {
        if (this.valueDeserializer != null) {
            return this.valueDeserializer(value);
        }

        if (this.type === SchemaTypes.Date) {
            return new Date(value);
        }

        if (this.type === SchemaTypes.String) {
            return String(value);
        }

        if (this.type === SchemaTypes.Number) {
            return Number(value);
        }

        if (this.type === SchemaTypes.Boolean) {
            return Boolean(value);
        }

        throw new Error(`Unsupported deserialization for type.  Type: ${this.type}`);
    }
}

type AssignmentType = "FORCE_NULLABLE_OR_OPTIONAL" | "ASSIGNMENT";