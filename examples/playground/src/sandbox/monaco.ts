import 'monaco-editor/features/register.all';
import 'monaco-editor/languages/definitions/typescript/register';
import { editor, Uri } from 'monaco-editor/editor';
import { getTypeScriptWorker, JsxEmit, ModuleKind, ModuleResolutionKind, ScriptTarget, typescriptDefaults } from 'monaco-editor/languages/features/typescript/register';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import TypeScriptWorker from 'monaco-editor/languages/features/typescript/ts.worker?worker';

declare global {
    interface Window {
        MonacoEnvironment?: { getWorker(workerId: string, label: string): Worker };
    }
}

let configured = false;

const configure = (): void => {
    if (configured) {
        return;
    }

    configured = true;

    window.MonacoEnvironment = {
        getWorker: (_workerId, label) => label === 'typescript' || label === 'javascript' ? new TypeScriptWorker() : new EditorWorker(),
    };

    typescriptDefaults.setCompilerOptions({
        target: ScriptTarget.ESNext,
        module: ModuleKind.CommonJS,
        moduleResolution: ModuleResolutionKind.NodeJs,
        jsx: JsxEmit.ReactJSX,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        strict: false,
    });

    typescriptDefaults.setEagerModelSync(true);

    void import('./typeLibrary').then(({ typeLibrary }) => {
        for (const file of typeLibrary()) {
            typescriptDefaults.addExtraLib(file.content, file.path);
        }
    });
};

export const modelFor = (file: string, code: string): editor.ITextModel => {
    configure();

    const uri = Uri.parse(`file:///src/examples/${file}`);
    const existing = editor.getModel(uri);

    if (existing !== null) {
        existing.setValue(code);
        return existing;
    }

    return editor.createModel(code, 'typescript', uri);
};

export const createEditor = (container: HTMLElement, model: editor.ITextModel): editor.IStandaloneCodeEditor =>
    editor.create(container, {
        model,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        scrollBeyondLastLine: false,
        tabSize: 4,
        theme: 'vs-dark',
    });

export const compile = async (model: editor.ITextModel): Promise<string> => {
    const worker = await (await getTypeScriptWorker())(model.uri);
    const output = await worker.getEmitOutput(model.uri.toString());
    const js = output.outputFiles.find(file => file.name.endsWith('.js'));

    if (js === undefined) {
        throw new Error('The TypeScript compiler produced no JavaScript for this file.');
    }

    return js.text;
};
