import type { ReactiveController, ReactiveControllerHost } from "lit";
import { pendingLiveQueryState, subscribeLiveQuery, type LiveQuery, type LiveQueryState } from "@routier/core/results";

export type { LiveQuery, LiveQueryState } from "@routier/core/results";

export type LiveQueryArgument = string | number | boolean | bigint | symbol | object | null | undefined;

export type LiveQueryControllerOptions<T, TArgs extends readonly LiveQueryArgument[]> =
  | { query: LiveQuery<T> }
  | { args: () => TArgs; query: (args: TArgs) => LiveQuery<T> };

type Resolved<T, TArgs> = { query: LiveQuery<T>; args: TArgs | null };

const sameArgs = (previous: readonly LiveQueryArgument[], next: readonly LiveQueryArgument[]) =>
  previous.length === next.length && previous.every((value, index) => Object.is(value, next[index]));

export class LiveQueryController<T, TArgs extends readonly LiveQueryArgument[] = readonly []> implements ReactiveController {
  state: LiveQueryState<T> = pendingLiveQueryState();
  hostUpdate?: () => void;

  private subscription: { stop: () => void; args: TArgs | null } | null = null;
  private readonly resolve: () => Resolved<T, TArgs>;

  constructor(
    private readonly host: ReactiveControllerHost,
    options: LiveQueryControllerOptions<T, TArgs>,
  ) {
    if ("args" in options) {
      this.resolve = () => {
        const args = options.args();

        return { query: options.query(args), args };
      };
      this.hostUpdate = () => {
        const args = this.subscription?.args;

        if (args != null && sameArgs(args, options.args()) === false) {
          this.start();
        }
      };
    } else {
      this.resolve = () => ({ query: options.query, args: null });
    }

    host.addController(this);
  }

  hostConnected(): void {
    this.start();
  }

  hostDisconnected(): void {
    this.subscription?.stop();
    this.subscription = null;
  }

  private start(): void {
    this.hostDisconnected();
    this.state = pendingLiveQueryState();

    const { query, args } = this.resolve();

    this.subscription = {
      args,
      stop: subscribeLiveQuery(query, (next) => {
        this.state = next;
        this.host.requestUpdate();
      }),
    };
  }
}
