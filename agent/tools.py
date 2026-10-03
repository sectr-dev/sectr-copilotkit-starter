"""Support-agent tools — 100% vanilla openai-agents code. No sectr imports.

One useful tool (lookup_order) +
one gated tool (refund, via Sectr's native HITL `needs_approval`).
"""

import asyncio

from agents import function_tool


@function_tool
async def lookup_order(order_id: str) -> dict[str, str]:
    """Look up the status of an order."""
    # A slow backend call: refresh the page while it runs — the turn keeps
    # going on Sectr and the chat picks it back up.
    await asyncio.sleep(8)
    return {"order_id": order_id, "status": "shipped"}


@function_tool(needs_approval=True)
async def refund(order_id: str) -> str:
    """Refund an order (requires manager approval)."""
    return f"Refunded {order_id}"
