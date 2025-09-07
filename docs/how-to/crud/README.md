# CRUD Operations

Routier provides a powerful and intuitive CRUD (Create, Read, Update, Delete) API that leverages change tracking and proxy-based entities for efficient data management.

## Overview

CRUD operations in Routier work through a **DataStore** class that you inherit from. The DataStore manages collections of entities and provides change tracking through proxy objects. Here's how it works:

1. **Create a DataStore** by inheriting from the base class
2. **Define collections** using schemas
3. **Perform operations** on collections (add, remove, update)
4. **Track changes** automatically through proxy entities
5. **Save changes** when ready to persist

## ⚠️ Critical: Persistence Requires Explicit Save

**Important: Changes made to entities (including adds, updates, and deletes) are NOT automatically persisted to the database. You must explicitly call `saveChanges()` or `saveChangesAsync()` to persist any changes.**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-1.ts %}{% endhighlight %}


## Creating a DataStore

### Basic Setup


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-2.ts %}{% endhighlight %}


### Using Different Plugins


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-3.ts %}{% endhighlight %}


## CRUD Operations

### Callback API Result Pattern

Routier uses a **discriminated union result pattern** for callback-based operations. The callback receives a single `result` parameter that can be either:

- **Success**: `{ ok: "success", data: T }`
- **Error**: `{ ok: "error", error: any }`


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-4.ts %}{% endhighlight %}


### Create (Add)

#### Adding Single Entities


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-5.ts %}{% endhighlight %}


#### Adding Multiple Entities


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-6.ts %}{% endhighlight %}


#### Adding with Callbacks


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-7.ts %}{% endhighlight %}


### Read (Query)

#### Basic Queries


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-8.ts %}{% endhighlight %}


#### Filtered Queries


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-9.ts %}{% endhighlight %}


#### Sorting and Pagination


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-10.ts %}{% endhighlight %}


#### Aggregation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-11.ts %}{% endhighlight %}


### Update

#### Direct Property Updates

The key feature of Routier is that entities returned from queries are **proxy objects** that automatically track changes:


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-12.ts %}{% endhighlight %}


#### Batch Updates


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-13.ts %}{% endhighlight %}


#### Update with Callbacks


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-14.ts %}{% endhighlight %}


### Delete (Remove)

#### Removing Single Entities


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-15.ts %}{% endhighlight %}


#### Removing Multiple Entities


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-16.ts %}{% endhighlight %}


#### Removing by Query


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-17.ts %}{% endhighlight %}


#### Remove with Callbacks


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-18.ts %}{% endhighlight %}


## Change Tracking and Persistence

### How Change Tracking Works

Routier uses **proxy objects** to automatically track changes to entities:

1. **Entities are proxied** when returned from queries
2. **Property changes are tracked** automatically
3. **Changes accumulate** in memory until you explicitly save them
4. **No manual update calls** needed for tracking
5. **Changes are NOT persisted until saveChanges() is called**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-19.ts %}{% endhighlight %}


### Checking for Changes


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-20.ts %}{% endhighlight %}


### Saving Changes

**Important: Changes are NOT automatically persisted to the database. You must explicitly call `saveChanges()` or `saveChangesAsync()` to persist any changes.**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-21.ts %}{% endhighlight %}


## Complete CRUD Example


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-22.ts %}{% endhighlight %}


## Best Practices

### 1. **Use Async Methods for Simplicity**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-23.ts %}{% endhighlight %}


### 2. **Leverage Change Tracking**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-24.ts %}{% endhighlight %}


### 3. **Batch Operations When Possible**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-25.ts %}{% endhighlight %}


### 4. **Save Changes Strategically**

**Critical: You must call `saveChanges()` or `saveChangesAsync()` to persist any changes to the database.**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-26.ts %}{% endhighlight %}


### 5. **Handle Errors Gracefully**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/README/block-27.ts %}{% endhighlight %}


## Next Steps

- [Bulk Operations](bulk/) - Advanced bulk CRUD operations
- [Data Collections](../data-collections/) - Understanding collections and change tracking
- [Queries](../../core-concepts/queries/) - Advanced querying capabilities
- [State Management](../state-management/) - Managing application state with Routier
