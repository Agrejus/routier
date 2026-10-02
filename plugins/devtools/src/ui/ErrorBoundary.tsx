import { Component, type ComponentChildren } from "preact";
import { reportError } from "../errors/reportError";

interface ErrorBoundaryProps {
  children: ComponentChildren;
}

interface ErrorBoundaryState {
  message: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { message: null };

  componentDidCatch(error: Error) {
    this.setState({ message: reportError("render", error).message });
  }

  render() {
    if (this.state.message === null) return this.props.children;
    return (
      <p class="state-message error" role="alert">
        Devtools failed to render: {this.state.message}
      </p>
    );
  }
}
