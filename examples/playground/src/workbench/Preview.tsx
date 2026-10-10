import { Component, type ComponentType, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

class PreviewBoundary extends Component<Props, State> {
    override state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    override render() {
        return this.state.error === null
            ? this.props.children
            : <p className="error">The component threw while rendering: {this.state.error.message}</p>;
    }
}

export function Preview({ Component: Rendered, runId }: { Component: ComponentType; runId: number }) {
    return (
        <div className="preview">
            <PreviewBoundary key={runId}><Rendered /></PreviewBoundary>
        </div>
    );
}
