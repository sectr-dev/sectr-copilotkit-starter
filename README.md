# Sectr + CopilotKit starter

[CopilotKit's quickstart](https://docs.copilotkit.ai/quickstart), with the
agent running on [Sectr](https://sectr.dev). Every Sectr route is an
[AG-UI](https://docs.ag-ui.com) endpoint, so CopilotKit's chat talks to it
directly. You get streaming, tool calls, and approvals as native interrupts,
and conversations are durable sessions: Sectr stores them, so your server
stores nothing.

- `agent/`: a support agent with a tool that needs human approval, served on
  two routes: `/chat_oai` (OpenAI Agents SDK, the agent `sectr init`
  generates) and `/chat_langgraph` (the same agent on LangGraph).
- Everything else: a Next.js app with a CopilotKit chat, one page per
  route.

## Run it locally (no keys needed)

Install the [Sectr CLI](https://docs.sectr.dev/getting-started/install/),
then:

```sh
npm install
cd agent && sectr dev
```

`sectr dev` prints one AG-UI URL per route:

```
- 🔌 connect via AG-UI at: https://local.sectr.dev:8420/ag-ui/support-agent/chat_oai
- 🔌 connect via AG-UI at: https://local.sectr.dev:8420/ag-ui/support-agent/chat_langgraph
```

`.env.development` already points at the first; the app derives the
LangGraph URL from it. In a second terminal, from the repo root:

```sh
npm run dev
```

If `sectr dev` says it picked another port (8420 was busy), put the
`chat_oai` URL it printed in `.env.local`: `SECTR_AGUI_URL=<that URL>`.

Open http://localhost:3000 (the OpenAI Agents SDK agent) or
http://localhost:3000/langgraph (the LangGraph one; the header switches
between them) and try these on either:

1. **Chat:** "Where is order 123?"
2. **Approve:** "Please refund it." The agent pauses on the `refund` tool.
   Approve or deny it in the chat.
3. **Refresh mid-answer:** ask about an order again and reload while the
   (deliberately slow) lookup runs. The turn keeps going on Sectr, and the
   reloaded chat picks it back up.

Without an `OPENAI_API_KEY` both agents answer from a scripted mock
(`agent/fake.py`, `agent/fake_graph.py`). To use a real model
(`gpt-4o-mini` on both routes), set it in `agent/.env` (see
`agent/.env.example`).

## Deploy

```sh
cd agent
sectr deploy                    # prints the deployed AG-UI URLs
sectr secrets set OPENAI_API_KEY  # optional: use a real model in the cloud
```

Then deploy the Next.js app anywhere Node runs. Set:

| Variable | Value |
| --- | --- |
| `SECTR_AGUI_URL` | the `chat_oai` URL `sectr deploy` printed |
| `SECTR_INVOCATION_KEY` | your app's invocation key (dashboard → Settings → API keys). Server-side only. |

The app's server is stateless: the Copilot Runtime runs with `SectrRunner`,
which keeps no copy of any conversation. A reloaded page, a second device, a
restarted or serverless instance all get the conversation from Sectr. Host it
however you like (Vercel, a container, `next start`).

## How it works

| File | What it does |
| --- | --- |
| `agent/app.py` | The agent and its two routes: `/chat_oai` (OpenAI Agents SDK) and `/chat_langgraph` |
| `agent/support_graph.py` | The same agent on LangGraph (`create_agent`), with the tools from `agent/graph_tools.py` |
| `app/api/copilotkit/[[...slug]]/route.ts` | The Copilot Runtime, with one `SectrAgent` per route (the quickstart uses `BuiltInAgent` here) and `SectrRunner` |
| `app/api/agent-token/route.ts` | Mints a Sectr user token (`sks_…`) for the current user. This is the only place the invocation key is used. |
| `app/providers.tsx` | Fetches the token once per page load and passes it to CopilotKit. The Runtime forwards it to Sectr. |
| `app/chat.tsx` | `CopilotSidebar`, plus `useInterrupt` for the approve/deny UI, for one `agentId` |
| `app/page.tsx`, `app/langgraph/page.tsx` | One chat page per agent |
| `proxy.ts` | Stand-in for your auth: an anonymous user id cookie, and a `?thread=` id per conversation |

There's no CopilotKit LangGraph integration here (`LangGraphAgent`, LangGraph
Platform): Sectr serves AG-UI for every route whatever the framework, so the
LangGraph agent is the same `SectrAgent` as the other one.

`SectrAgent` and `SectrRunner` come from the [`@sectr/copilotkit`](https://www.npmjs.com/package/@sectr/copilotkit)
package. `SectrRunner` replaces CopilotKit's default in-memory runner: runs and
reconnects go straight to Sectr, so the server holds no conversation state.
`SectrAgent` is `@ag-ui/client`'s `HttpAgent` plus reconnecting a reloaded
page, which `SectrRunner` does through it.

`package.json` pins `@copilotkit/*` and `@ag-ui/client` to exact versions
that match: each CopilotKit release pins its own `@ag-ui/client`, and a second
copy of it doesn't type-check against CopilotKit's. Upgrade them together.

A user token can only see conversations owned by the user it was minted for,
and because the Runtime keeps nothing, there's no copy anywhere else for
another user to reach. (CopilotKit's default in-memory runner serves every
thread in its memory to any caller, which is why this starter replaces it.)
In your app, replace the anonymous cookie with your signed-in user's id. Sectr
never authenticates your users; it trusts your backend's mint call.

Docs: [Connecting your frontend](https://docs.sectr.dev/getting-started/connecting-frontend/),
[Using LangGraph](https://docs.sectr.dev/getting-started/langgraph/).

## Checks

```sh
just check
```

This is what CI runs: `npm ci`, lint and build, plus the agent
(`agent/uv.lock` in sync, `uv sync --frozen`, and `app.py` importing with no
provider key, as `sectr dev` and deploy need). Needs `just`, `uv` and Node 20+.

## License

MIT
