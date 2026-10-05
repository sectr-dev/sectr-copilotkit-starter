import {
  EventType,
  runHttpRequest,
  transformHttpEventStream,
  type BaseEvent,
  type HttpAgent,
} from "@ag-ui/client";
import { createRunEventFinalizer } from "@copilotkit/shared";
import {
  AgentRunner,
  type AgentRunnerConnectRequest,
  type AgentRunnerRunRequest,
} from "@copilotkit/runtime/v2";
import { defer, Observable } from "rxjs";

// A stateless Copilot Runtime runner: Sectr's journal is the conversation, so
// this server keeps no copy of it. (CopilotKit's default in-memory runner
// keeps every thread in process memory and serves it back to any caller.)
// Every read and write goes to Sectr with the user's token, and Sectr only
// shows a user their own threads. Deploy it anywhere: serverless, several
// instances, restarts all fine.
export class SectrRunner extends AgentRunner {
  // The same agents map you pass to CopilotRuntime: connect() reads each
  // agent's Sectr URL from it.
  constructor(private readonly options: { agents: Record<string, HttpAgent> }) {
    super();
  }

  // A run streams straight from Sectr: one POST to the route's AG-UI endpoint
  // (the Runtime has already forwarded the browser's `Authorization`).
  run({ agent, input }: AgentRunnerRunRequest): Observable<BaseEvent> {
    const events = new Observable<BaseEvent>((subscriber) => {
      agent
        .runAgent(input, { onEvent: ({ event }) => subscriber.next(event) })
        .then(
          () => subscriber.complete(),
          (error) => subscriber.error(error),
        );
      return () => agent.abortRun();
    });
    return closeWithRunError(events, { protocolVersion: input.protocolVersion });
  }

  // A reloaded page reattaches to its conversation from Sectr: the thread's
  // history, plus its latest run replayed — still streaming if the agent is
  // mid-turn, or ending in the pending approval. A new thread has no run, so
  // the stream is empty.
  connect({ threadId, agentId, headers }: AgentRunnerConnectRequest): Observable<BaseEvent> {
    const events = defer(() => {
      const url = new URL(this.urlFor(agentId));
      url.searchParams.set("threadId", threadId);
      return transformHttpEventStream(
        runHttpRequest(() =>
          fetch(url, { method: "GET", headers: { ...headers, Accept: "text/event-stream" } }),
        ),
      );
    });
    return closeWithRunError(events, { emptyIsOk: true });
  }

  // The turn's state lives on Sectr (a busy thread answers 409), and Sectr
  // has no cancel: closing the stream never stops the turn.
  async isRunning(): Promise<boolean> {
    return false;
  }

  async stop(): Promise<boolean> {
    return false;
  }

  private urlFor(agentId = "default"): string {
    const agent = this.options.agents[agentId];
    if (!agent) throw new Error(`SectrRunner: no agent ${JSON.stringify(agentId)} in its agents map`);
    return agent.url;
  }
}

// If Sectr refuses the request (401/404/409) or the stream breaks, end it
// with a RUN_ERROR so the chat shows the error instead of spinning or staying
// silently empty. `emptyIsOk`: a stream that completes without ever starting
// a run is fine as is (connect on a new thread).
function closeWithRunError(
  events: Observable<BaseEvent>,
  { protocolVersion, emptyIsOk = false }: { protocolVersion?: string; emptyIsOk?: boolean },
): Observable<BaseEvent> {
  return new Observable<BaseEvent>((subscriber) => {
    const finalizer = createRunEventFinalizer();
    let started = false;
    const finish = (interruptionMessage?: string) => {
      const closers = finalizer.finalize({
        ...(protocolVersion !== undefined ? { protocolVersion } : {}),
        ...(interruptionMessage !== undefined ? { interruptionMessage } : {}),
      });
      for (const event of closers) subscriber.next(event);
      subscriber.complete();
    };
    const subscription = events.subscribe({
      next: (event) => {
        started ||= event.type === EventType.RUN_STARTED;
        finalizer.observe(event);
        subscriber.next(event);
      },
      error: (error) => finish(error instanceof Error ? error.message : String(error)),
      complete: () => (started || !emptyIsOk ? finish() : subscriber.complete()),
    });
    return () => subscription.unsubscribe();
  });
}
