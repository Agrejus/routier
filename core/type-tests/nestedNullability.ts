/**
 * Modifiers on properties inside `s.object(...)` must survive inference the same way they do
 * at the top level (#42). Each assignment below fails to compile when the type is wrong.
 */
import { s, type InferCreateType, type InferType } from '@routier/core/schema';

type N<X> = null extends X ? true : false;
type Opt<O, K extends keyof O> = {} extends Pick<O, K> ? true : false;

const itemShape = {
    note: s.string().nullable(),
    opt: s.string().optional(),
    ro: s.string().readonly(),
    plain: s.string()
};

const schema = s.define('thing', {
    id: s.string().key(),
    topNote: s.string().nullable(),
    items: s.object(itemShape).array(),
    nested: s.object({ note: s.string().nullable() }),
    deep: s.object({ inner: s.object({ note: s.string().nullable() }).array() }).array(),
    arrNull: s.object({ note: s.string().nullable() }).array().nullable(),
    arrOpt: s.object({ note: s.string().nullable() }).array().optional(),
    arrTag: s.object({ note: s.string().nullable() }).array().tag('t'),
    objTag: s.object({ note: s.string().nullable() }).tag('t'),
    objNull: s.object({ a: s.string(), n: s.string().nullable() }).nullable()
}).compile();

type T = InferType<typeof schema>;

// The harness itself must be strict, or every nullable assertion passes vacuously.
// @ts-expect-error `string` does not admit null under strictNullChecks
const harnessIsStrict: N<string> = true;

const topLevel: N<T['topNote']> = true;
const inObjectArray: N<T['items'][number]['note']> = true;
const optionalInObjectArray: Opt<T['items'][number], 'opt'> = true;
const plainInObjectArray: Opt<T['items'][number], 'plain'> = false;
const plainNotNullable: N<T['items'][number]['plain']> = false;

const inObject: N<T['nested']['note']> = true;
const nullableIsNotOptional: Opt<T['nested'], 'note'> = false;

const twoLevelsDeep: N<T['deep'][number]['inner'][number]['note']> = true;

const inNullableArray: N<NonNullable<T['arrNull']>[number]['note']> = true;
const arrayItselfNullable: N<T['arrNull']> = true;
const inOptionalArray: N<NonNullable<T['arrOpt']>[number]['note']> = true;
const inTaggedArray: N<T['arrTag'][number]['note']> = true;
const inTaggedObject: N<T['objTag']['note']> = true;

declare const p: T;
const fromNullableObject: string = p.objNull!.a;
const inNullableObject: N<NonNullable<T['objNull']>['n']> = true;
const nullableObjectItself: N<T['objNull']> = true;

// @ts-expect-error a readonly child stays readonly inside an object array
p.items[0].ro = 'changed';

const created: InferCreateType<typeof schema>['items'] = [{ note: null, ro: 'r', plain: 'p' }];

export {
    harnessIsStrict, topLevel, inObjectArray, optionalInObjectArray, plainInObjectArray,
    plainNotNullable, inObject, nullableIsNotOptional, twoLevelsDeep, inNullableArray,
    arrayItselfNullable, inOptionalArray, inTaggedArray, inTaggedObject, fromNullableObject,
    inNullableObject, nullableObjectItself, created
};
