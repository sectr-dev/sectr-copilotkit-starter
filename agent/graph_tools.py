"""Support-agent tools for the LangGraph route: the same two tools as
tools.py (same names, arguments and results), so the UI and the approval
card behave identically on both routes.

Why these import sectr when tools.py doesn't: LangGraph has no per-tool
approval without its checkpointer, and Sectr runs graphs without one (the
journal is the checkpoint). So the tools are framework-free sectr tools,
converted to LangChain tools in support_graph.py with `as_langgraph_tool`,
which provides the gating: a gated call pauses the turn, and once the
approval lands the adapter runs the call.
"""

import asyncio

from sectr.tools import tool


@tool
async def lookup_order(order_id: str) -> dict[str, str]:
    """Look up the status of an order."""
    # A slow backend call: refresh the page while it runs — the turn keeps
    # going on Sectr and the chat picks it back up.
    await asyncio.sleep(8)
    return {"order_id": order_id, "status": "shipped"}


@tool(needs_approval=True)
async def refund(order_id: str) -> str:
    """Refund an order (requires manager approval)."""
    return f"Refunded {order_id}"


TOOLS = [lookup_order, refund]
