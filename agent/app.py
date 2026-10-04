"""Your Sectr agent — the support agent on the OpenAI Agents SDK.

Everything here is ordinary openai-agents code: zero platform concepts
leak into the agent definition; the only sectr touchpoints are `AgentApp`
and one adapter line (the adapter maps the SDK's native streaming events
and HITL interruptions onto the platform contract).

Model selection:
- `OPENAI_API_KEY` set → the real model, on the standard OpenAI API.
- No key → the scripted mock in fake.py answers, so `sectr dev` works
  with ZERO env vars.
"""

from agents import (
    Agent,
)
from sectr import AgentApp
from sectr.adapters.openai_agents import openai_agents

from fake import setup_model
from tools import lookup_order, refund

# If OPENAI_API_KEY is set, uses gpt-4o-mini, otherwise uses a mock model. To set OPENAI_API_KEY:
# - For local `sectr dev`, cp .env.example .env and put in your key.
# - For prod deployment, set secrets with `sectr secrets set OPENAI_API_KEY` or visit https://app.sectr.dev/settings
model = setup_model()

agent = Agent(
    name="support",
    instructions=(
        "You are a customer-support agent for a small shop. "
        "Look up order status with the lookup_order tool, "
        "and issue refunds with the refund tool."
    ),
    tools=[lookup_order, refund],
    model=model,
)

app = AgentApp(name="support-agent", env=["OPENAI_API_KEY"])
app.add_route("/chat", openai_agents(agent, model=model))
