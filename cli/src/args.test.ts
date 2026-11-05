import { describe, expect, it } from '@jest/globals';
import { parseCommandLine } from './args';

describe('parseCommandLine', () => {
    it('needs no arguments beyond the command', () => {
        expect(parseCommandLine(['generate'])).toEqual({
            kind: 'generate',
            options: { patterns: [], out: 'src' },
        });
    });

    it('reads the patterns and the output folder', () => {
        expect(parseCommandLine(['generate', 'a.ts', 'b/*.ts', '--out', 'gen'])).toEqual({
            kind: 'generate',
            options: { patterns: ['a.ts', 'b/*.ts'], out: 'gen' },
        });
    });

    it.each([[['--help']], [['generate', '--help']]])('shows help for %j', argv => {
        expect(parseCommandLine(argv)).toEqual({ kind: 'help' });
    });

    it.each([
        [[], 'Name a command.'],
        [['build'], 'Unknown command: build.'],
    ])('rejects %j', (argv, message) => {
        expect(parseCommandLine(argv)).toEqual({ kind: 'invalid', message });
    });

    it('rejects an unknown option', () => {
        expect(parseCommandLine(['generate', 'a.ts', '--nope'])).toMatchObject({
            kind: 'invalid',
            message: expect.stringContaining('--nope'),
        });
    });
});
