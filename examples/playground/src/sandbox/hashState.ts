export type HashState = { id: string | null; shared: string | null };

const SHARED = '&code=';

export const parseHash = (hash: string): HashState => {
    const body = hash.replace(/^#/, '');
    const at = body.indexOf(SHARED);
    const id = at === -1 ? body : body.slice(0, at);

    return { id: id === '' ? null : id, shared: at === -1 ? null : body.slice(at + SHARED.length) };
};

export const hashFor = (id: string, shared: string | null): string => shared === null ? `#${id}` : `#${id}${SHARED}${shared}`;
