# agent — a Sectr agent

Scaffolded by `sectr init` — a support agent on the OpenAI Agents SDK,
with a human-in-the-loop approval built in.

## Run it locally (no keys needed)

```bash
sectr dev
```

The scripted mock (fake.py) answers the model — the first run works with
zero env vars. Send messages with `sectr send ...` (the dashboard opens
automatically and shows the live session).

## Go real (optional)

```bash
cp .env.example .env      # put your OPENAI_API_KEY in .env
```

Real runs use the standard OpenAI API (`gpt-4o-mini` by default; override
with `SECTR_MODEL`).

## The approval flow

`refund` is a gated tool (`needs_approval=True`). When the agent calls it,
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

- `app.py` — the agent + the sectr touchpoints (AgentApp, one adapter line)
- `fake.py` — deterministic mock model (key-free demo)
- `tools.py` — one free tool, one approval-gated tool
- `sectr.toml` — app name, entrypoint, Python version
- `.env.example` — the optional real-model key