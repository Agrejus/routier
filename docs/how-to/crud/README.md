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


{% capture snippet_inlt8l %}{% include code/from-docs/how-to/crud/README/block-1.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_inlt8l }}{% endhighlight %}


## Creating a DataStore

### Basic Setup


{% capture snippet_c9yalp %}{% include code/from-docs/how-to/crud/README/block-2.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_c9yalp }}{% endhighlight %}


### Using Different Plugins


{% capture snippet_9rqdgd %}{% include code/from-docs/how-to/crud/README/block-3.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_9rqdgd }}{% endhighlight %}


## CRUD Operations

### Callback API Result Pattern

Routier uses a **discriminated union result pattern** for callback-based operations. The callback receives a single `result` parameter that can be either:

- **Success**: `{ ok: "success", data: T }`
- **Error**: `{ ok: "error", error: any }`


{% capture snippet_pvi8qq %}{% include code/from-docs/how-to/crud/README/block-4.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_pvi8qq }}{% endhighlight %}


### Create (Add)

#### Adding Single Entities


{% capture snippet_rpjfdj %}{% include code/from-docs/how-to/crud/README/block-5.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_rpjfdj }}{% endhighlight %}


#### Adding Multiple Entities


{% capture snippet_hum0xd %}{% include code/from-docs/how-to/crud/README/block-6.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_hum0xd }}{% endhighlight %}


#### Adding with Callbacks


{% capture snippet_5remab %}{% include code/from-docs/how-to/crud/README/block-7.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_5remab }}{% endhighlight %}


### Read (Query)

#### Basic Queries


{% capture snippet_plmliu %}{% include code/from-docs/how-to/crud/README/block-8.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_plmliu }}{% endhighlight %}


#### Filtered Queries


{% capture snippet_5ykcgs %}{% include code/from-docs/how-to/crud/README/block-9.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_5ykcgs }}{% endhighlight %}


#### Sorting and Pagination


{% capture snippet_orluis %}{% include code/from-docs/how-to/crud/README/block-10.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_orluis }}{% endhighlight %}


#### Aggregation


{% capture snippet_o89v2i %}{% include code/from-docs/how-to/crud/README/block-11.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_o89v2i }}{% endhighlight %}


### Update

#### Direct Property Updates

The key feature of Routier is that entities returned from queries are **proxy objects** that automatically track changes:


{% capture snippet_odwrsz %}{% include code/from-docs/how-to/crud/README/block-12.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_odwrsz }}{% endhighlight %}


#### Batch Updates


{% capture snippet_ajq9ip %}{% include code/from-docs/how-to/crud/README/block-13.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ajq9ip }}{% endhighlight %}


#### Update with Callbacks


{% capture snippet_niq4xm %}{% include code/from-docs/how-to/crud/README/block-14.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_niq4xm }}{% endhighlight %}


### Delete (Remove)

#### Removing Single Entities


{% capture snippet_461037 %}{% include code/from-docs/how-to/crud/README/block-15.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_461037 }}{% endhighlight %}


#### Removing Multiple Entities


{% capture snippet_z4pjbb %}{% include code/from-docs/how-to/crud/README/block-16.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_z4pjbb }}{% endhighlight %}


#### Removing by Query


{% capture snippet_ilub79 %}{% include code/from-docs/how-to/crud/README/block-17.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ilub79 }}{% endhighlight %}


#### Remove with Callbacks


{% capture snippet_ay5tzu %}{% include code/from-docs/how-to/crud/README/block-18.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ay5tzu }}{% endhighlight %}


## Change Tracking and Persistence

### How Change Tracking Works

Routier uses **proxy objects** to automatically track changes to entities:

1. **Entities are proxied** when returned from queries
2. **Property changes are tracked** automatically
3. **Changes accumulate** in memory until you explicitly save them
4. **No manual update calls** needed for tracking
5. **Changes are NOT persisted until saveChanges() is called**


{% capture snippet_nm1j0m %}{% include code/from-docs/how-to/crud/README/block-19.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_nm1j0m }}{% endhighlight %}


### Checking for Changes


{% capture snippet_bru5vp %}{% include code/from-docs/how-to/crud/README/block-20.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_bru5vp }}{% endhighlight %}


### Saving Changes

**Important: Changes are NOT automatically persisted to the database. You must explicitly call `saveChanges()` or `saveChangesAsync()` to persist any changes.**


{% capture snippet_0of7vx %}{% include code/from-docs/how-to/crud/README/block-21.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_0of7vx }}{% endhighlight %}


## Complete CRUD Example


{% capture snippet_9k4u8w %}{% include code/from-docs/how-to/crud/README/block-22.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_9k4u8w }}{% endhighlight %}


## Best Practices

### 1. **Use Async Methods for Simplicity**


{% capture snippet_u6y5qk %}{% include code/from-docs/how-to/crud/README/block-23.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_u6y5qk }}{% endhighlight %}


### 2. **Leverage Change Tracking**


{% capture snippet_vjsaav %}{% include code/from-docs/how-to/crud/README/block-24.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_vjsaav }}{% endhighlight %}


### 3. **Batch Operations When Possible**


{% capture snippet_heqfkp %}{% include code/from-docs/how-to/crud/README/block-25.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_heqfkp }}{% endhighlight %}


### 4. **Save Changes Strategically**

**Critical: You must call `saveChanges()` or `saveChangesAsync()` to persist any changes to the database.**


{% capture snippet_firi5i %}{% include code/from-docs/how-to/crud/README/block-26.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_firi5i }}{% endhighlight %}


### 5. **Handle Errors Gracefully**


{% capture snippet_s9q7m4 %}{% include code/from-docs/how-to/crud/README/block-27.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_s9q7m4 }}{% endhighlight %}


## Next Steps

- [Bulk Operations](bulk/) - Advanced bulk CRUD operations
- [Data Collections](../data-collections/) - Understanding collections and change tracking
- [Queries](../../core-concepts/queries/) - Advanced querying capabilities
- [State Management](../state-management/) - Managing application state with Routier
