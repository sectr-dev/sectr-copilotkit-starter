# agent — a Sectr agent

Started from `sectr init`, plus a LangGraph route: the same support agent,
with a human-in-the-loop approval built in, served on two routes:

- `/chat_oai`: on the OpenAI Agents SDK (`app.py`; `sectr init` names this
  route `/chat`).
- `/chat_langgraph`: on LangGraph (`support_graph.py`).

## Run it locally (no keys needed)

```bash
sectr dev
```

The scripted mocks (fake.py, fake_graph.py) answer the model — the first run
works with zero env vars. `sectr dev` prints one AG-UI URL per route. The
dashboard opens automatically and shows the live session; its playground
has a route picker.

Until SEC-143 lands, local `sectr send` reaches only the first route
(`/chat_oai`). To try `/chat_langgraph` locally, use the starter UI
(`/langgraph`) or the dashboard playground's route picker.

## Go real (optional)

```bash
cp .env.example .env      # put your OPENAI_API_KEY in .env
```

Real runs use the standard OpenAI API (`gpt-4o-mini`), on both routes.

## The approval flow

`refund` is a gated tool (`needs_approval=True`; on the LangGraph route, a
sectr tool converted with `as_langgraph_tool`). When the agent calls it,
the session **pauses** and shows up in the dashboard approval inbox (or:
`sectr send --approve --session <id>`). Approve it and the same turn
resumes — that's Sectr's human-in-the-loop.

## Ship it

```bash
sectr deploy
```

Your agent becomes an HTTPS endpoint with durable sessions and SSE
streaming. To go real on the cloud, set the model key as a project
secret (values are write-only: they can be set, never read back):

```bash
sectr secrets set OPENAI_API_KEY
```

## Files

- `app.py` — the agent + the sectr touchpoints (AgentApp, one adapter line
  per route)
- `fake.py` — deterministic mock model (key-free demo)
- `tools.py` — one free tool, one approval-gated tool
- `support_graph.py` — the same agent on LangGraph
- `graph_tools.py` — the same tools, as sectr tools for LangGraph
- `fake_graph.py` — the LangGraph route's mock model
- `sectr.toml` — app name, entrypoint, Python version
- `.env.example` — the optional real-model key