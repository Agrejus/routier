[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / parseSelector

# Function: parseSelector()

> **parseSelector**(`schema`, `selector`): [`ParsedSelector`](../type-aliases/ParsedSelector.md)

Defined in: [core/src/expressions/parser.ts:2755](https://github.com/Agrejus/routier/blob/main/core/src/expressions/parser.ts#L2755)

Reads a sort, map, group or `nearest` selector with the grammar filters use, for what its value is
read from.

Not for evaluating it: the caller's function stays the value, and nothing here renders one. A plugin
decides from the result whether it can run the option. One that orders or projects by column cannot
run a value that is not the property itself, and one that runs the function over stored rows cannot
run it over a renamed property.

So the grammar is wider here than for a filter. A call it has no node for, such as `getFullYear()`,
is kept for the operands it reads rather than refused, since the function it came from still runs.

`not-parsable` is not logged. The option runs as it did before the selector was parsed.

Cached by function source per schema, like `toExpression`. The result is shared, so it is read-only.

## Parameters

### schema

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`any`\>

### selector

(...`args`) => `unknown`

## Returns

[`ParsedSelector`](../type-aliases/ParsedSelector.md)
