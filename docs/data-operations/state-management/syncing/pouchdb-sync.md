---
title: PouchDB Syncing
layout: default
parent: Syncing
grand_parent: State Management
nav_order: 1
---

# PouchDB Syncing

PouchDB provides robust synchronization capabilities that work seamlessly with Routier. This guide covers how to set up and configure PouchDB syncing based on the actual implementation.

## Overview

The PouchDB plugin automatically handles synchronization when you configure the `sync` option. The syncing system is built on top of PouchDB's battle-tested replication engine and provides:

- **Automatic sync setup** when the plugin initializes
- **Bidirectional replication** between local and remote databases
- **Conflict detection and resolution**
- **Automatic retry with exponential backoff**
- **Live synchronization** for real-time updates

## Basic Configuration

Enable syncing by adding the `sync` configuration to your PouchDB plugin:

{% capture snippet_76qv3x %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_76qv3x | strip }}{% endhighlight %}

## Sync Options Reference

### `remoteDb` (Required)

The URL to your remote CouchDB-compatible database:

{% capture snippet_d9e51x %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_d9e51x | strip }}{% endhighlight %}

### `live` (Optional)

Controls whether synchronization is continuous or one-time:

{% capture snippet_usu4cz %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_usu4cz | strip }}{% endhighlight %}

**Default:** `false`

### `retry` (Optional)

Enables automatic retry with exponential backoff:

{% capture snippet_9eeast %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_9eeast | strip }}{% endhighlight %}

**Default:** `false`

### `onChange` (Optional)

Callback function that receives sync events and schema information:

{% capture snippet_7afs59 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_7afs59 | strip }}{% endhighlight %}

## How PouchDB Syncing Works

### 1. **Automatic Initialization**

When you create a PouchDB plugin with sync enabled, the system automatically:

{% capture snippet_nrcx9t %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_nrcx9t | strip }}{% endhighlight %}

### 2. **Retry Logic**

The plugin implements intelligent retry with exponential backoff:

{% capture snippet_orfro9 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_orfro9 | strip }}{% endhighlight %}

- **Initial delay:** 1 second
- **Maximum delay:** 10 seconds
- **Backoff formula:** `Math.min(delay * 2, 10000)`

### 3. **Event Handling**

Sync events are automatically routed to your `onChange` callback:

{% capture snippet_vgs66c %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_vgs66c | strip }}{% endhighlight %}

## Complete Example

Here's a full example of setting up PouchDB syncing with Routier:

{% capture snippet_pqvvto %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_pqvvto | strip }}{% endhighlight %}

## Conflict Resolution

PouchDB automatically detects conflicts when the same document is modified in multiple places. Handle conflicts in your `onChange` callback:

{% capture snippet_07xx3a %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_07xx3a | strip }}{% endhighlight %}

## Advanced Configuration

### Custom Sync Options

You can pass additional PouchDB sync options:

{% capture snippet_vdqpgh %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_vdqpgh | strip }}{% endhighlight %}

### Multiple Remote Databases

Sync with multiple remote databases:

{% capture snippet_uzg7vy %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_uzg7vy | strip }}{% endhighlight %}

## Monitoring and Debugging

### Sync Status Monitoring

Track sync progress and status:

{% capture snippet_ea1k9s %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_ea1k9s | strip }}{% endhighlight %}

### Error Handling

Handle sync errors gracefully:

{% capture snippet_is7ga0 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_is7ga0 | strip }}{% endhighlight %}

### Debug Mode

Enable detailed logging for troubleshooting:

{% capture snippet_mlbki7 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_mlbki7 | strip }}{% endhighlight %}

## Performance Optimization

### Filtered Sync

Only sync necessary documents:

{% capture snippet_0q66hb %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_0q66hb | strip }}{% endhighlight %}

### Batch Operations

Optimize sync performance with batch operations:

{% capture snippet_a3geum %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_a3geum | strip }}{% endhighlight %}

## Best Practices

### 1. **Network Handling**

{% capture snippet_9z23g5 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_9z23g5 | strip }}{% endhighlight %}

### 2. **Error Recovery**

{% capture snippet_si26s4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_si26s4 | strip }}{% endhighlight %}

### 3. **Data Validation**

{% capture snippet_6pkm8p %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_6pkm8p | strip }}{% endhighlight %}

## Troubleshooting

### Common Issues

1. **Authentication Errors**

   - Check credentials and permissions
   - Verify remote database access

2. **Network Issues**

   - Check connectivity
   - Verify remote database URL
   - Check firewall settings

3. **Conflict Resolution**
   - Implement proper conflict handling
   - Use document versioning
   - Consider business logic for merging

### Debug Commands

{% capture snippet_6uhw2t %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_6uhw2t | strip }}{% endhighlight %}

## Next Steps

- Learn about [Live Queries](../live-queries/) for real-time updates
- Explore [Change Tracking](../../modification/change-tracking/) for local modifications
- See [Advanced Syncing](../advanced-syncing/) for complex scenarios
- Check out [PouchDB Plugin](../../../plugins/built-in-plugins/pouchdb/) for more details
