import type { BaseEvent } from "@ag-ui/client";
import { createRunEventFinalizer } from "@copilotkit/shared";
import {
  AgentRunner,
  type AgentRunnerRunRequest,
} from "@copilotkit/runtime/v2";
import { EMPTY, Observable } from "rxjs";

// A stateless Copilot Runtime runner: Sectr's journal is the conversation, so
// this server keeps no copy of it. (CopilotKit's default in-memory runner
// keeps every thread in process memory and serves it back to any caller.)
// Every read and write goes to Sectr with the user's token, and Sectr only
// shows a user their own threads. Deploy it anywhere: serverless, several
// instances, restarts all fine.
export class SectrRunner extends AgentRunner {
  // A run streams straight from Sectr: one POST to the route's AG-UI endpoint
  // (the Runtime has already forwarded the browser's `Authorization`).
  run({ agent, input }: AgentRunnerRunRequest): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      // If Sectr refuses the run (401/404/409) or the stream breaks, close it
      // with a RUN_ERROR so the chat shows the error instead of spinning.
      const finalizer = createRunEventFinalizer();
      const finish = (interruptionMessage?: string) => {
        const closers = finalizer.finalize({
          protocolVersion: input.protocolVersion,
          ...(interruptionMessage !== undefined ? { interruptionMessage } : {}),
        });
        for (const event of closers) subscriber.next(event);
        subscriber.complete();
      };
      agent
        .runAgent(input, {
          onEvent: ({ event }) => {
            finalizer.observe(event);
            subscriber.next(event);
          },
        })
        .then(
          () => finish(),
          (error) => finish(error instanceof Error ? error.message : String(error)),
        );
      return () => agent.abortRun();
    });
  }

  // A reloaded page reattaches to its conversation from Sectr.
  // TODO(SEC-130): forward to Sectr's AG-UI connect endpoint; until then a
  // reloaded page starts empty and fills in on the next message.
  connect(): Observable<BaseEvent> {
    return EMPTY;
  }

  // The turn's state lives on Sectr (a busy thread answers 409), and Sectr
  // has no cancel: closing the stream never stops the turn.
  async isRunning(): Promise<boolean> {
    return false;
  }

  async stop(): Promise<boolean> {
    return false;
  }
}
