import { etags, s, type InferCreateType, type InferType } from '@routier/core/schema';

type N<X> = null extends X ? true : false;
type Opt<O, K extends keyof O> = {} extends Pick<O, K> ? true : false;
type Equal<A, B> = (<G>() => G extends A ? 1 : 2) extends (<G>() => G extends B ? 1 : 2) ? true : false;
type Ro<O, K extends keyof O> = Equal<Pick<O, K>, Readonly<Pick<O, K>>>;

const schema = s.define('etag_types', {
    id: s.string().key(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
    revision: s.string().etag(etags.lexical).nullable(),
}).compile();

const optionalSchema = s.define('etag_optional_types', {
    id: s.string().key(),
    revision: s.string().etag(etags.lexical).optional(),
}).compile();

type T = InferType<typeof schema>;
type O = InferType<typeof optionalSchema>;
type C = InferCreateType<typeof schema>;
type NumberEtagArgument = Parameters<ReturnType<typeof s.number>['etag']>[0];
type StringEtagArgument = Parameters<ReturnType<typeof s.string>['etag']>[0];

const versionIsNumber: Equal<T['version'], number> = true;
const versionNotNullable: N<T['version']> = false;
const versionRequired: Opt<T, 'version'> = false;
const versionReadonly: Ro<T, 'version'> = true;
const nameWritable: Ro<T, 'name'> = false;

const revisionNullable: N<T['revision']> = true;
const revisionIsStringOrNull: Equal<T['revision'], string | null> = true;
const revisionRequired: Opt<T, 'revision'> = false;
const revisionReadonly: Ro<T, 'revision'> = true;

const optionalRevision: Opt<O, 'revision'> = true;
const optionalRevisionReadonly: Ro<O, 'revision'> = true;
const optionalRevisionNotNullable: N<Exclude<O['revision'], undefined>> = false;

const versionNotCreatable: 'version' extends keyof C ? false : true = true;
const revisionNotCreatable: 'revision' extends keyof C ? false : true = true;
const nameCreatable: 'name' extends keyof C ? true : false = true;

const numberRejectsLexical: typeof etags.lexical extends NumberEtagArgument ? false : true = true;
const stringRejectsNumeric: typeof etags.numeric extends StringEtagArgument ? false : true = true;
const numberAcceptsNumeric: typeof etags.numeric extends NumberEtagArgument ? true : false = true;

export {
    versionIsNumber, versionNotNullable, versionRequired, versionReadonly, nameWritable,
    revisionNullable, revisionIsStringOrNull, revisionRequired, revisionReadonly,
    optionalRevision, optionalRevisionReadonly, optionalRevisionNotNullable,
    versionNotCreatable, revisionNotCreatable, nameCreatable,
    numberRejectsLexical, stringRejectsNumeric, numberAcceptsNumeric,
};
