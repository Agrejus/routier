# JavaScript Performance Overhead Guide

This document outlines common sources of overhead in JavaScript applications and strategies to minimize them.

## Memory Overhead

### 1. Object Creation

Creating many objects, especially in loops, increases memory pressure and GC overhead.

**Example:**

```typescript
// ❌ Bad - creates new object on each iteration
for (let i = 0; i < 1000; i++) {
  const obj = { id: i, value: computeValue(i) };
  process(obj);
}

// ✅ Better - reuse object or use array
const obj = {};
for (let i = 0; i < 1000; i++) {
  obj.id = i;
  obj.value = computeValue(i);
  process(obj);
}
```

### 2. Closure Capture

Closures that capture large scopes keep more data in memory than necessary.

**Example:**

```typescript
// ❌ Bad - captures entire outer scope
function createHandler(largeObject) {
  return function () {
    // Only needs one property, but captures entire object
    return largeObject.someProperty;
  };
}

// ✅ Better - extract only what's needed
function createHandler(largeObject) {
  const neededValue = largeObject.someProperty;
  return function () {
    return neededValue;
  };
}
```

### 3. Event Listeners

Not removing event listeners causes memory leaks.

**Example:**

```typescript
// ❌ Bad - listener never removed
element.addEventListener("click", handler);

// ✅ Better - remove when done
element.addEventListener("click", handler);
// Later...
element.removeEventListener("click", handler);
```

### 4. Global Variables

Keeping references to large objects in global scope prevents garbage collection.

### 5. Circular References

Circular references between objects can prevent garbage collection.

### 6. Large Arrays/Strings

Keeping unnecessary data in memory when only a subset is needed.

### 7. Prototype Chains

Deep inheritance hierarchies increase memory usage and property lookup time.

### 8. WeakMaps/WeakSets

Using regular Maps/Sets when Weak variants would allow garbage collection.

---

## CPU Overhead

### 9. Type Coercion

Implicit type conversions (`==`) are slower than explicit comparisons (`===`), though the difference is small. More importantly, `===` prevents bugs.

**Example:**

```typescript
// ⚠️ Slower and can cause bugs - implicit coercion
if (value == 0) {
  // Also matches "", false, null, undefined
}

// ✅ Faster and safer - explicit comparison
if (value === 0) {
  // Only matches the number 0
}
```

**Note:** The performance difference between `==` and `===` is negligible (< 0.1%) in modern engines. However, `===` is strongly preferred because:

1. It's more predictable (no type coercion surprises)
2. It's slightly faster (no coercion overhead)
3. It's the recommended best practice

### 10. String Concatenation

Using `+` in loops can create intermediate strings, though modern engines optimize this well for small strings.

**Example:**

```typescript
// ⚠️ Can be slower - creates intermediate strings
// (modern engines optimize small concatenations, but large ones still have overhead)
let result = "";
for (let i = 0; i < 1000; i++) {
  result += items[i];
}

// ✅ Better for large concatenations - use array.join()
// (more predictable performance, especially for many/large strings)
const parts = [];
for (let i = 0; i < 1000; i++) {
  parts.push(items[i]);
}
const result = parts.join("");
```

**Note:** Modern JavaScript engines (V8) optimize string concatenation with `+` for small strings (< ~1000 characters). For larger strings or many concatenations, `array.join()` is more efficient and predictable.

### 11. Array Methods

Multiple passes over arrays instead of a single pass.

**Example:**

```typescript
// ❌ Bad - multiple passes
const filtered = items.filter((x) => x.active);
const mapped = filtered.map((x) => x.name);
const sorted = mapped.sort();

// ✅ Better - single pass or combine operations
const result = items
  .filter((x) => x.active)
  .map((x) => x.name)
  .sort();
// Or use a single reduce for maximum performance
```

### 12. Nested Loops

O(n²) or worse algorithms when O(n) or O(n log n) is possible.

**Example:**

```typescript
// ❌ Bad - O(n²)
for (const item of items) {
  const found = otherItems.find((x) => x.id === item.id);
}

// ✅ Better - O(n) with Map
const map = new Map(otherItems.map((x) => [x.id, x]));
for (const item of items) {
  const found = map.get(item.id);
}
```

### 13. Regular Expressions

Complex or unoptimized regex patterns can be slow.

**Example:**

```typescript
// ❌ Bad - catastrophic backtracking
/^(a+)+$/.test("aaaaaaaaaaaaaaaaaaaa!");

// ✅ Better - optimized pattern
/^a+$/.test("aaaaaaaaaaaaaaaaaaaa!");
```

### 14. Function Calls

Deep call stacks and excessive recursion add overhead.

### 15. Property Access

Deeply nested property access (`obj.a.b.c.d`) requires multiple lookups.

**Example:**

```typescript
// ❌ Bad - multiple property lookups
const value = obj.a.b.c.d;

// ✅ Better - cache intermediate values
const c = obj.a.b.c;
const value = c.d;
```

### 16. Type Checking

Excessive `typeof`, `instanceof` checks in hot paths.

### 17. Try/Catch Blocks

Exception handling has overhead, especially in hot paths.

**Example:**

```typescript
// ❌ Bad - try/catch in hot loop
for (let i = 0; i < 1000000; i++) {
  try {
    process(items[i]);
  } catch (e) {
    // rarely happens
  }
}

// ✅ Better - validate before loop
for (let i = 0; i < 1000000; i++) {
  process(items[i]);
}
```

### 18. eval() / Function()

Dynamic code execution is very slow and should be avoided.

### 19. with Statements

Deprecated and adds significant overhead.

---

## Rendering/DOM Overhead

### 20. DOM Queries

Repeated `querySelector` calls are expensive.

**Example:**

```typescript
// ❌ Bad - queries DOM multiple times
for (let i = 0; i < 100; i++) {
  document.querySelector(`#item-${i}`).textContent = values[i];
}

// ✅ Better - query once
const elements = Array.from({ length: 100 }, (_, i) =>
  document.querySelector(`#item-${i}`)
);
for (let i = 0; i < 100; i++) {
  elements[i].textContent = values[i];
}
```

### 21. Layout Thrashing

Reading and writing DOM properties in loops forces multiple layouts.

**Example:**

```typescript
// ❌ Bad - layout thrashing
for (const element of elements) {
  element.style.width = computeWidth(element); // write
  const height = element.offsetHeight; // read - forces layout
}

// ✅ Better - batch reads, then writes
const heights = elements.map((el) => el.offsetHeight); // batch reads
elements.forEach((el, i) => {
  el.style.width = computeWidth(el, heights[i]); // batch writes
});
```

### 22. Repaints/Reflows

Changing styles that trigger layout recalculations.

### 23. Large DOM Trees

Too many elements in the DOM increases memory and rendering cost.

### 24. Inline Styles

Using inline styles instead of CSS classes.

### 25. Event Delegation

Not using event delegation for many similar elements.

**Example:**

```typescript
// ❌ Bad - many listeners
items.forEach((item) => {
  item.addEventListener("click", handler);
});

// ✅ Better - single delegated listener
container.addEventListener("click", (e) => {
  if (e.target.matches(".item")) {
    handler(e);
  }
});
```

---

## Network Overhead

### 26. Bundle Size

Large JavaScript bundles increase download and parse time.

**Strategies:**

- Code splitting
- Tree shaking
- Minification
- Compression (gzip/brotli)

### 27. Unused Imports

Importing entire libraries for one function.

**Example:**

```typescript
// ❌ Bad - imports entire library
import _ from "lodash";
const result = _.debounce(fn, 100);

// ✅ Better - import only what's needed
import debounce from "lodash/debounce";
const result = debounce(fn, 100);
```

### 28. Multiple Requests

Not batching API calls.

### 29. No Caching

Re-fetching the same data repeatedly.

### 30. Large Payloads

Sending/receiving unnecessary data.

---

## Framework/Library Overhead

### 31. Virtual DOM Diffing

Unnecessary re-renders in React/Vue/etc.

**Strategies:**

- Use `React.memo()` for expensive components
- Memoize callbacks with `useCallback()`
- Memoize values with `useMemo()`

### 32. Reactive Systems

Too many watchers/subscriptions can slow down reactivity.

### 33. Proxy Objects

Proxy traps add overhead to property access.

**Note:** Your Routier project uses proxies for change tracking, which is necessary for the feature but adds overhead. Consider optimizing by:

- Only proxying when change tracking is enabled
- Minimizing proxy depth
- Using Object.defineProperty for simple cases

### 34. Decorators

Runtime decorator overhead (TypeScript decorators compile to runtime code).

### 35. Reflection

Using `Object.keys()`, `Object.entries()` frequently.

**Example:**

```typescript
// ❌ Bad - reflection in hot path
for (const key of Object.keys(obj)) {
  process(obj[key]);
}

// ✅ Better - if possible, use known keys
const keys = ["a", "b", "c"]; // known at compile time
for (const key of keys) {
  process(obj[key]);
}
```

---

## Async/Promise Overhead

### 36. Promise Chains

Deep promise chains can be slower than async/await.

**Example:**

```typescript
// ❌ Can be slower
fetch(url)
  .then((r) => r.json())
  .then((data) => process(data))
  .then((result) => save(result));

// ✅ Often faster and more readable
const response = await fetch(url);
const data = await response.json();
const result = await process(data);
await save(result);
```

### 37. Microtasks

Excessive `queueMicrotask` calls can delay other work.

### 38. setTimeout/setInterval

Many timers running simultaneously.

### 39. Event Loop Blocking

Long-running synchronous code blocks the event loop.

**Example:**

```typescript
// ❌ Bad - blocks event loop
function processLargeArray(items) {
  for (let i = 0; i < 1000000; i++) {
    heavyComputation(items[i]);
  }
}

// ✅ Better - yield to event loop
async function processLargeArray(items) {
  for (let i = 0; i < 1000000; i++) {
    heavyComputation(items[i]);
    if (i % 1000 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}
```

---

## Code Structure Overhead

### 40. Dynamic Imports

Overhead of dynamic `import()` calls (though often worth it for code splitting).

### 41. Source Maps

Including source maps in production increases bundle size.

### 42. Console Logs

Leaving `console.log` in production adds overhead.

**Solution:** Use a build-time tool to strip console logs in production.

### 43. Debug Code

Development-only code left in production builds.

### 44. Polyfills

Unnecessary polyfills for modern browsers.

### 45. Transpilation

Over-transpiling modern code (e.g., transpiling ES2020 to ES5 when target supports ES2020).

---

## Data Structure Overhead

### 46. Array vs Set/Map

Using arrays for lookups when Sets/Maps would be O(1).

**Example:**

```typescript
// ❌ Bad - O(n) lookup
const items = [1, 2, 3, 4, 5];
if (items.includes(3)) {
}

// ✅ Better - O(1) lookup
const items = new Set([1, 2, 3, 4, 5]);
if (items.has(3)) {
}
```

### 47. Object vs Map

Using objects when Maps are more appropriate (e.g., dynamic keys, need for size property).

### 48. Sparse Arrays

Arrays with many empty slots waste memory.

### 49. Nested Structures

Deeply nested objects/arrays increase property lookup time.

---

## Micro-Optimizations

These are small optimizations that can add up in hot paths (code that runs frequently). While individual gains may be small, they can significantly impact performance when executed millions of times.

### 50. Function Call Overhead in Loops

Calling a function in a loop has overhead compared to inlining the logic directly. However, modern JavaScript engines (V8, SpiderMonkey) use JIT compilation and can inline small, frequently-called functions automatically.

**Example:**

```typescript
// ⚠️ Can be slower - function call overhead on each iteration
// (unless engine inlines it)
function processItem(item) {
  return item.value * 2;
}

for (let i = 0; i < 1000000; i++) {
  result[i] = processItem(items[i]);
}

// ✅ Faster - logic inlined in loop
// (guaranteed to be fast, no function call overhead)
for (let i = 0; i < 1000000; i++) {
  result[i] = items[i].value * 2;
}
```

**When to use functions:**

- Code reusability is important
- Function is called infrequently
- Logic is complex and readability matters more
- Modern JavaScript engines can inline small functions (JIT optimization)

**When to inline:**

- Hot path code (runs millions of times)
- Very simple operations
- Performance is critical
- Function is too complex for engines to inline reliably

**Note:** Modern engines (V8, SpiderMonkey) can inline functions automatically, but this isn't guaranteed. For critical hot paths, manual inlining is safer.

### 51. Loop Variable Caching

Accessing array length or object properties in loop conditions can be slower than caching them, though modern engines optimize this well.

**Example:**

```typescript
// ⚠️ Can be slower - accesses length property on each iteration
// (modern engines often optimize this, but not guaranteed)
for (let i = 0; i < items.length; i++) {
  process(items[i]);
}

// ✅ Faster - caches length explicitly
// (guaranteed to be fast, no property access overhead)
for (let i = 0, length = items.length; i < length; i++) {
  process(items[i]);
}

// ✅ Also fast - modern for...of (has iterator overhead but optimized)
for (const item of items) {
  process(item);
}
```

**Note:** Modern JavaScript engines (V8, SpiderMonkey) often optimize `array.length` access in loops, making manual caching less necessary. However, for guaranteed performance in hot paths, explicit caching is still recommended. The difference is usually negligible (< 1%).

### 52. Property Access Caching

Repeated property access is slower than caching the value.

**Example:**

```typescript
// ❌ Slower - multiple property lookups
for (let i = 0; i < items.length; i++) {
  if (items[i].config.enabled && items[i].config.visible) {
    process(items[i]);
  }
}

// ✅ Faster - cache property access
for (let i = 0, length = items.length; i < length; i++) {
  const item = items[i];
  const config = item.config;
  if (config.enabled && config.visible) {
    process(item);
  }
}
```

### 53. Avoiding Unnecessary Function Calls

Calling functions that return constants or simple values can be avoided.

**Example:**

```typescript
// ❌ Slower - function call overhead
function getDefaultValue() {
  return 0;
}

for (let i = 0; i < 1000000; i++) {
  const value = getDefaultValue();
}

// ✅ Faster - use constant directly
const DEFAULT_VALUE = 0;
for (let i = 0; i < 1000000; i++) {
  const value = DEFAULT_VALUE;
}
```

### 54. Loop Unrolling

For very small, fixed-size loops, unrolling can eliminate loop overhead.

**Example:**

```typescript
// ❌ Has loop overhead
for (let i = 0; i < 4; i++) {
  result[i] = items[i] * 2;
}

// ✅ Faster for small fixed loops (but less readable)
result[0] = items[0] * 2;
result[1] = items[1] * 2;
result[2] = items[2] * 2;
result[3] = items[3] * 2;
```

**Note:** Modern JavaScript engines often unroll small loops automatically, so manual unrolling is rarely needed.

### 55. Variable Declaration Location

Declaring variables inside loops vs outside has minimal performance difference in modern JavaScript.

**Example:**

```typescript
// ✅ Both are fast - modern engines handle block scoping efficiently
for (let i = 0; i < 1000000; i++) {
  const temp = computeValue(i);
  process(temp);
}

// ✅ Also fast - variable declared outside loop
let temp;
for (let i = 0; i < 1000000; i++) {
  temp = computeValue(i);
  process(temp);
}
```

**Note:** Modern JavaScript engines optimize block-scoped variables (`const`, `let`) efficiently. The performance difference is negligible (< 0.1%). Use `const` inside loops for better code quality and immutability guarantees. Only declare outside if you need to reuse the variable after the loop.

### 56. Avoiding Array Methods in Hot Loops

Array methods like `forEach`, `map`, `filter` have function call overhead for each element, though modern engines optimize these well.

**Example:**

```typescript
// ⚠️ Can be slower - forEach has function call overhead
// (engines optimize this, but traditional loops are still faster)
items.forEach((item) => {
  process(item);
});

// ✅ Faster - traditional for loop (fastest for hot paths)
for (let i = 0, length = items.length; i < length; i++) {
  process(items[i]);
}

// ✅ Also fast - for...of (has iterator overhead but optimized)
for (const item of items) {
  process(item);
}
```

**Performance Comparison (typical):**

- Traditional `for` loop: Fastest (~100% baseline)
- `for...of` loop: ~95-98% of traditional for loop
- `forEach`: ~90-95% of traditional for loop

**Trade-off:** Array methods are more readable and functional, but traditional loops are measurably faster in hot paths (5-10% difference). For non-critical paths, use array methods for better code quality.

### 57. Bitwise Operations

Bitwise operations can be faster than arithmetic for certain operations.

**Example:**

```typescript
// ❌ Slower - division
const half = value / 2;

// ✅ Faster - bitwise shift
const half = value >> 1;

// ❌ Slower - modulo
const isEven = value % 2 === 0;

// ✅ Faster - bitwise AND
const isEven = (value & 1) === 0;
```

**Note:** Only use when performance is critical and the code is in a hot path. Readability often matters more.

### 58. Avoiding Object Creation in Loops

Creating objects in loops is expensive. Reuse objects when possible.

**Example:**

```typescript
// ❌ Slower - creates new object each iteration
for (let i = 0; i < 1000000; i++) {
  const obj = { id: i, value: compute(i) };
  process(obj);
}

// ✅ Faster - reuse object
const obj = {};
for (let i = 0; i < 1000000; i++) {
  obj.id = i;
  obj.value = compute(i);
  process(obj);
}
```

### 59. String Template vs Concatenation

For simple concatenation, template literals and `+` operator have similar performance in modern engines.

**Example:**

```typescript
// ✅ Both are fast - modern engines optimize both well
const result = `${a}${b}${c}`;
const result2 = a + b + c;
```

**Note:** Modern JavaScript engines (V8, SpiderMonkey) optimize both template literals and string concatenation equally well. The performance difference is negligible (< 0.1%). Choose based on readability and consistency. Template literals are generally preferred for their clarity and ability to handle multi-line strings.

### 60. Avoiding Unnecessary Coercions

Avoid unnecessary type conversions in hot paths.

**Example:**

```typescript
// ❌ Slower - unnecessary string conversion
for (let i = 0; i < 1000000; i++) {
  const key = String(i);
  map.set(key, values[i]);
}

// ✅ Faster - use number as key directly
for (let i = 0; i < 1000000; i++) {
  map.set(i, values[i]);
}
```

### 61. Early Returns

Early returns can avoid unnecessary computation.

**Example:**

```typescript
// ❌ Slower - always computes full result
function process(item) {
  const result = expensiveComputation(item);
  if (item.skip) {
    return null;
  }
  return result;
}

// ✅ Faster - early return avoids computation
function process(item) {
  if (item.skip) {
    return null;
  }
  return expensiveComputation(item);
}
```

### 62. Switch vs If-Else Chains

Switch statements can be faster than long if-else chains, especially when engines can use jump table optimization.

**Example:**

```typescript
// ⚠️ Can be slower - linear search through conditions
// (engines optimize this, but switch is often faster for many cases)
if (value === "a") {
  return 1;
} else if (value === "b") {
  return 2;
} else if (value === "c") {
  return 3;
} // ... many more

// ✅ Faster for many cases - can use jump table optimization
// (engines can create O(1) jump tables for dense integer cases)
switch (value) {
  case "a":
    return 1;
  case "b":
    return 2;
  case "c":
    return 3;
  // ...
}
```

**Note:** Modern engines optimize both well. Switch statements can use jump tables for dense integer cases (O(1) lookup), while if-else chains are O(n). For string cases or sparse cases, the difference is smaller. Switch is generally preferred for readability and potential performance benefits with many cases (> 5-10 cases).

### 63. Avoiding Arguments Object

The `arguments` object is slower than rest parameters.

**Example:**

```typescript
// ❌ Slower - arguments object
function sum() {
  let total = 0;
  for (let i = 0; i < arguments.length; i++) {
    total += arguments[i];
  }
  return total;
}

// ✅ Faster - rest parameters
function sum(...args) {
  let total = 0;
  for (let i = 0; i < args.length; i++) {
    total += args[i];
  }
  return total;
}
```

### Micro-Optimization Guidelines

1. **Measure First** - Micro-optimizations often have negligible impact. Profile before optimizing.

2. **Focus on Hot Paths** - Only optimize code that runs frequently (millions of times).

3. **Readability Matters** - Don't sacrifice readability for tiny performance gains.

4. **Modern Engines** - JavaScript engines (V8, SpiderMonkey) are highly optimized. Many micro-optimizations are done automatically.

5. **Trade-offs** - Consider the trade-off between performance and maintainability.

6. **Real-World Impact** - A 10% improvement in code that runs once per second is less valuable than a 1% improvement in code that runs 1000 times per second.

---

## Routier-Specific Optimizations

Based on the Routier codebase, here are optimizations that have been implemented:

### ✅ Completed Optimizations

1. **QueryOptionsCollection.add()** - Avoided array spread, using direct push
2. **ChangeTracker.prepareAdditions()** - Pre-allocated arrays with known size
3. **CollectionBase.cloneMany()** - Early returns and pre-allocated arrays
4. **CollectionBase.afterPersist()** - Conditional object creation
5. **View.ts** - Map-based lookups instead of O(n²) find loops
6. **DataStore.saveChanges()** - Early exit when no collections have changes
7. **EphemeralDataPlugin.bulkPersist()** - Skip load() for adds-only operations
8. **TrampolinePipeline** - Optimized type checks and removed unnecessary queueMicrotask

### 🔍 Areas to Monitor

1. **Proxy Overhead** - Change tracking uses proxies, which adds overhead. Consider:

   - Only enabling proxies when needed
   - Shallow proxies where possible
   - Alternative tracking mechanisms for simple cases

2. **Subscription Management** - Ensure all subscriptions are properly cleaned up to avoid memory leaks

3. **Query Translation** - The query translation system processes queries - ensure it's optimized for common patterns

4. **Schema Compilation** - Code generation happens at compile time, but ensure generated code is efficient

5. **Memory Collections** - For large in-memory datasets, consider pagination or lazy loading

---

## Performance Measurement

### Tools

- **Chrome DevTools Performance Tab** - Profile CPU and memory
- **Chrome DevTools Memory Tab** - Identify memory leaks
- **Lighthouse** - Overall performance audit
- **WebPageTest** - Real-world performance testing
- **Bundle Analyzer** - Analyze bundle size

### Metrics to Track

- **Time to Interactive (TTI)** - When page becomes interactive
- **First Contentful Paint (FCP)** - When first content appears
- **Largest Contentful Paint (LCP)** - When main content loads
- **Cumulative Layout Shift (CLS)** - Visual stability
- **First Input Delay (FID)** - Responsiveness
- **Memory Usage** - Heap size, object counts
- **Bundle Size** - JavaScript bundle sizes

### Benchmarking

When making performance changes:

1. **Establish baseline** - Measure current performance
2. **Make changes** - Implement optimization
3. **Measure again** - Compare against baseline
4. **Verify correctness** - Ensure optimization doesn't break functionality
5. **Document results** - Record improvements for future reference

---

## Best Practices Summary

1. **Measure First** - Don't optimize without profiling
2. **Optimize Hot Paths** - Focus on code that runs frequently
3. **Avoid Premature Optimization** - Write clear code first, optimize when needed
4. **Use Appropriate Data Structures** - Choose the right tool for the job
5. **Minimize Object Creation** - Reuse objects when possible
6. **Batch Operations** - Group similar operations together
7. **Lazy Load** - Load data/code only when needed
8. **Cache Results** - Cache expensive computations
9. **Clean Up** - Remove event listeners, cancel timers, clear references
10. **Monitor Production** - Track performance metrics in production

---

## References

- [MDN Performance Best Practices](https://developer.mozilla.org/en-US/docs/Web/Performance)
- [Web.dev Performance](https://web.dev/performance/)
- [V8 Performance Tips](https://v8.dev/blog)
- [JavaScript Performance Patterns](https://www.smashingmagazine.com/2012/11/writing-fast-memory-efficient-javascript/)
