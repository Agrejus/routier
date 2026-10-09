import { useEffect, useRef } from 'react';
import type { editor } from 'monaco-editor/editor';
import { KeyCode, KeyMod } from 'monaco-editor/editor';
import { compile, createEditor, modelFor } from '../sandbox/monaco';

export type Compiler = { compile(): Promise<string> };

type Props = {
    file: string;
    code: string;
    onChange(code: string): void;
    onReady(compiler: Compiler): void;
    onRun(): void;
};

export default function CodeEditor({ file, code, onChange, onReady, onRun }: Props) {
    const container = useRef<HTMLDivElement>(null);
    const model = useRef<editor.ITextModel | null>(null);
    const latest = useRef({ onChange, onRun });
    latest.current = { onChange, onRun };

    useEffect(() => {
        if (container.current === null) {
            return;
        }

        const created = modelFor(file, code);
        const instance = createEditor(container.current, created);
        const changes = created.onDidChangeContent(() => latest.current.onChange(created.getValue()));
        model.current = created;

        instance.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, () => latest.current.onRun());
        onReady({ compile: () => compile(created) });

        return () => {
            changes.dispose();
            instance.dispose();
        };
    }, [file]);

    useEffect(() => {
        if (model.current !== null && model.current.getValue() !== code) {
            model.current.setValue(code);
        }
    }, [code]);

    return <div className="editor" ref={container} />;
}
