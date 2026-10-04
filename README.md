# Sectr + CopilotKit starter

[CopilotKit's quickstart](https://docs.copilotkit.ai/quickstart), with one
change: the agent runs on [Sectr](https://sectr.dev). Every Sectr route is an
[AG-UI](https://docs.ag-ui.com) endpoint, so CopilotKit's chat talks to it
directly. You get streaming, tool calls, and approvals as native interrupts,
and conversations are durable sessions.

- `agent/`: a support agent (OpenAI Agents SDK) with a tool that needs
  human approval. It's the project `sectr init` generates.
- Everything else: a Next.js app with a CopilotKit chat.

## Run it locally (no keys needed)

Install the [Sectr CLI](https://docs.sectr.dev/getting-started/install/),
then:

```sh
npm install
cd agent && sectr dev
```

`sectr dev` prints `🔌 connect via AG-UI at: https://local.sectr.dev:<port>/ag-ui/support-agent/chat`.
In a second terminal, from the repo root:

```sh
echo "SECTR_AGUI_URL=<that URL>" > .env.local
npm run dev
```

Open http://localhost:3000 and try these:

1. **Chat:** "Where is order 123?"
2. **Approve:** "Please refund it." The agent pauses on the `refund` tool.
   Approve or deny it in the chat.
3. **Refresh mid-answer:** ask about an order again and reload while the
   (deliberately slow) lookup runs. The turn keeps going on Sectr, and the
   reloaded chat picks it back up.

Without an `OPENAI_API_KEY` the agent answers from a scripted mock
(`agent/fake.py`). To use a real model, set it in `agent/.env` (see
`agent/.env.example`).

## Deploy

```sh
cd agent
sectr deploy                    # prints the deployed AG-UI URL
sectr secrets set OPENAI_API_KEY  # optional: use a real model in the cloud
```

Then deploy the Next.js app anywhere Node runs. Set:

| Variable | Value |
| --- | --- |
| `SECTR_AGUI_URL` | the URL `sectr deploy` printed |
| `SECTR_INVOCATION_KEY` | your app's invocation key (dashboard → Settings → API keys). Server-side only. |

Host it as a long-lived server (`next start`, a container). A reloaded page
gets the conversation, and any answer still in flight, from the Copilot
Runtime's memory. The turn itself runs on Sectr either way. After a Runtime
restart, a reopened conversation stays empty until the next message, when
Sectr sends the full history.

## How it works

| File | What it does |
| --- | --- |
| `app/api/copilotkit/[[...slug]]/route.ts` | The Copilot Runtime, with an `HttpAgent` pointed at `SECTR_AGUI_URL` (the quickstart uses `BuiltInAgent` here) |
| `app/api/agent-token/route.ts` | Mints a Sectr user token (`sks_…`) for the current user. This is the only place the invocation key is used. |
| `app/providers.tsx` | Fetches the token once per page load and passes it to CopilotKit. The Runtime forwards it to Sectr. |
| `app/chat.tsx` | `CopilotSidebar`, plus `useInterrupt` for the approve/deny UI |
| `proxy.ts` | Stand-in for your auth: an anonymous user id cookie, and a `?thread=` id per conversation |

A user token can only see conversations owned by the user it was minted for.
In your app, replace the anonymous cookie with your signed-in user's id. Sectr
never authenticates your users; it trusts your backend's mint call.

Docs: [Connecting your frontend](https://docs.sectr.dev/getting-started/connecting-frontend/).

## Smoke test

```sh
SECTR_AGUI_URL=... [SECTR_INVOCATION_KEY=...] npm run smoke
```

The smoke test runs a full turn, an approval interrupt, and the resume. It
works against `sectr dev` or a deployed agent. CI runs it daily against the
live demo agent.
