# Property Modifiers

Property modifiers in Routier allow you to customize the behavior, constraints, and metadata of your schema properties. They can be chained together to create powerful, flexible schemas that accurately represent your database structure.

## Quick Summary

- Default: Define default values for properties.
- Deserialize: Custom deserializer (e.g., parse ISO strings to Date).
- Distinct: Mark property as unique (distinct index).
- Identity: Mark property as database/computed identity (auto-generated).
- Index: Define single or composite indexes.
- Key: Define primary key.
- Nullable: Allow null.
- Optional: Allow undefined (omit the field).
- Readonly: Disallow modification after creation.
- Serialize: Custom serializer (e.g., Date to ISO string).
- Tracked: Persist computed value for indexing and faster reads.

## Available Modifiers

All schema types support these core modifiers:

- **`.optional()`** - Makes the property optional
- **`.nullable()`** - Allows the property to be null
- **`.default(value)`** - Sets a default value
- **`.readonly()`** - Makes the property read-only
- **`.deserialize(fn)`** - Custom deserialization function
- **`.serialize(fn)`** - Custom serialization function
- **`.array()`** - Converts the property to an array type
- **`.index(...names)`** - Creates database indexes

Additional modifiers are available on specific types:

- **`.key()`** - Marks as primary key (string, number, date)
- **`.identity()`** - Auto-generates values (string, number, date, boolean)
- **`.distinct()`** - Ensures unique values (string, number, date, boolean)

## Tracked (for computed values)

### `.tracked()`

Persists a computed value to the underlying store. Use when:

- You need to index or sort/filter by the computed value
- Recomputing is expensive and you want to cache post-save

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-1.ts %}{% endhighlight %}

Notes:

- `.tracked()` applies to computed properties. It does not change the computation, only persistence/indexability.
- Use `.tracked()` sparingly; it increases write costs but can greatly improve read performance.

## Identity and Keys

### `.key()`

Marks a property as a primary key for the entity.

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-2.ts %}{% endhighlight %}

**Available on:** `string`, `number`, `date`

### `.identity()`

Automatically generates a unique value for the property.

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-3.ts %}{% endhighlight %}

**Available on:** `string`, `number`, `date`, `boolean`

## Indexing

### `.index()`

Creates a database index for efficient querying.

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-4.ts %}{% endhighlight %}

**Available on:** All types

### Compound Indexes

Multiple fields can share the same index name for compound indexing.

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-5.ts %}{% endhighlight %}

## Defaults and Values

### `.default()`

Sets a default value for the property. Can accept either a direct value or a function that returns a value.

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-6.ts %}{% endhighlight %}

**Available on:** All types

**Note:** When using a function, it's evaluated each time a default is needed, making it perfect for dynamic values like timestamps or context-dependent defaults. The function can also accept an optional `injected` parameter for context-dependent defaults.

#### Insert semantics

- If a property has `.default(...)`, it is considered optional during inserts. When the value is omitted, Routier will supply the default.


{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-1.ts %}{% endhighlight %}


## Behavior Control

### `.optional()`

Makes the property optional (can be undefined).

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-7.ts %}{% endhighlight %}

**Available on:** All types

### `.nullable()`

Makes the property nullable (can be null).

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-8.ts %}{% endhighlight %}

**Available on:** All types

### `.readonly()`

Makes the property read-only after creation.

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-9.ts %}{% endhighlight %}

**Available on:** All types

## Serialization

### `.serialize()`

Custom serialization function for the property.

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-10.ts %}{% endhighlight %}

**Available on:** All types

### `.deserialize()`

Custom deserialization function for the property.

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-11.ts %}{% endhighlight %}

**Available on:** All types

## Type Conversion

### `.array()`

Converts the property to an array type.

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-12.ts %}{% endhighlight %}

**Available on:** All types

### `.distinct()`

Ensures the property value is unique across all entities.

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-13.ts %}{% endhighlight %}

**Available on:** `string`, `number`, `date`, `boolean`

## Chaining Modifiers

Modifiers can be chained together in any order:

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-14.ts %}{% endhighlight %}

## Modifier Compatibility

Not all modifiers can be used together. Here are the key rules:

### Mutually Exclusive Modifiers

- **`.optional()`** and **`.nullable()`** - Can be used together
- **`.key()`** and **`.optional()`** - Cannot be used together (keys are always required)
- **`.identity()`** and **`.default()`** - Cannot be used together (identity generates values)

### Modifier Order

While modifiers can be chained in any order, it's recommended to follow this pattern:

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-15.ts %}{% endhighlight %}

## Best Practices

### 1. **Use Built-in Modifiers**

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-16.ts %}{% endhighlight %}

### 2. **Define Constraints Early**

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-17.ts %}{% endhighlight %}

### 3. **Leverage Type Safety**

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-18.ts %}{% endhighlight %}

### 4. **Use Appropriate Modifiers**

{% highlight ts linenos %}{% include code/from-docs/concepts/schema/modifiers/README/block-19.ts %}{% endhighlight %}

## Next Steps

- [Property Types](../property-types/README.md) - Available property types
- [Creating A Schema](../creating-a-schema.md) - Back to schema creation
- [Schema Reference](../reference.md) - Complete schema API reference
