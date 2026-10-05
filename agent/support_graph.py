"""The support agent on LangGraph — the same agent as app.py's OpenAI
Agents SDK route, served on `/chat_langgraph`.

The graph is plain `langchain.agents.create_agent` with no checkpointer:
Sectr's journal is the checkpoint. Each turn is a fresh graph run whose
messages are rebuilt from the session transcript, and an approval pause
ends the turn; on approval the adapter runs the approved call and the graph
continues from the answered conversation. The tools are sectr tools (see
graph_tools.py) converted with `as_langgraph_tool`, which is what makes
`refund` approval-gated.

(Named support_graph.py, not langgraph.py, which would shadow the
`langgraph` package.)

Model selection, as in app.py:
- `OPENAI_API_KEY` set → gpt-4o-mini on the standard OpenAI API.
- No key → the scripted model in fake_graph.py answers, so `sectr dev`
  works with ZERO env vars. (`sectr dev` also imports this module before
  .env secrets are injected; the scripted model keeps that import clean.)
"""

import os

from langchain.agents import create_agent
from langchain_core.language_models.chat_models import BaseChatModel
from sectr.adapters.langgraph import as_langgraph_tool

from fake_graph import ScriptedChatModel
from graph_tools import TOOLS

INSTRUCTIONS = (
    "You are a customer-support agent for a small shop. "
    "Look up order status with the lookup_order tool, "
    "and issue refunds with the refund tool."
)

model: BaseChatModel
if api_key := os.environ.get("OPENAI_API_KEY"):
    from langchain.chat_models import init_chat_model

    model = init_chat_model("openai:gpt-4o-mini", api_key=api_key)
else:
    model = ScriptedChatModel()

graph = create_agent(
    model,
    tools=[as_langgraph_tool(t) for t in TOOLS],
    system_prompt=INSTRUCTIONS,
)
