## Extending Collections

You can extend a generated collection to add domain-specific helpers while preserving typing and change tracking.

### Example


{% capture snippet_4yc1wf %}{% include code/from-docs/how-to/collections/extending-collections/block-1.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_4yc1wf }}{% endhighlight %}


### Notes

- The `create((Instance, ...args) => new class extends Instance { ... })` pattern ensures the subclass receives the same constructor args and types as the base collection.
- Prefer adding cohesive, high-level helpers (e.g. `addPerformanceAsync`, `addWithDefaults`, `bulkImportAsync`).
- All base collection methods remain available (`where`, `map`, `toArrayAsync`, `saveChangesAsync`, attachments, etc.).

### When to use

- Encapsulate repeated collection-specific operations.
- Provide intent-revealing APIs for your domain while keeping the underlying query and persistence behavior.
