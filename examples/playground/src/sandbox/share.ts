const toBase64Url = (bytes: Uint8Array): string =>
    btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> =>
    Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0));

const through = async (bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> =>
    new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

export const encodeShared = async (code: string): Promise<string> =>
    toBase64Url(await through(new TextEncoder().encode(code), new CompressionStream('deflate-raw')));

export const decodeShared = async (text: string): Promise<string | null> => {
    try {
        return new TextDecoder().decode(await through(fromBase64Url(text), new DecompressionStream('deflate-raw')));
    } catch {
        return null;
    }
};
