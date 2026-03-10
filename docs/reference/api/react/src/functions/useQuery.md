[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [react/src](../README.md) / useQuery

# Function: useQuery()

> **useQuery**\<`T`\>(`query`, `deps`): `LiveQueryState`\<`T`\>

Defined in: [react/src/useQuery.tsx:9](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/react/src/useQuery.tsx#L9)

## Type Parameters

### T

`T`

## Parameters

### query

(`callback`) => `void` \| () => `void`

Function that sets up the subscription and invokes the callback with results. **Must return** the unsubscribe handler (the return value of the query chain, e.g. `.subscribe().where(...).firstOrUndefined(callback)`) so the hook can clean up on unmount or when dependencies change.

### deps

`any`[] = `[]`

## Returns

`LiveQueryState`\<`T`\>
