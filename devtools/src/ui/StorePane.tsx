import { Component } from "preact";
import type { StoreEntry } from "../host/storeEntry";
import type { FrameScheduler } from "../live/frameScheduler";
import { StateMessage } from "./StateMessage";
import { StoreBrowser } from "./StoreBrowser";

interface StorePaneProps {
  entry: StoreEntry;
  scheduler: FrameScheduler;
}

interface StorePaneState {
  disposed: boolean;
}

export class StorePane extends Component<StorePaneProps, StorePaneState> {
  state: StorePaneState = { disposed: this.props.entry.inspection.disposed.aborted };

  private readonly markDisposed = () => this.setState({ disposed: true });

  componentDidMount() {
    this.props.entry.inspection.disposed.addEventListener("abort", this.markDisposed);
  }

  componentWillUnmount() {
    this.props.entry.inspection.disposed.removeEventListener("abort", this.markDisposed);
  }

  render() {
    if (this.state.disposed) {
      return <StateMessage>This store was disposed. Devtools stopped watching it.</StateMessage>;
    }
    return <StoreBrowser inspection={this.props.entry.inspection} scheduler={this.props.scheduler} />;
  }
}
