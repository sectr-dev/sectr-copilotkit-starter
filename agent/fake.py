"""Deterministic scripted model — the key-free answerer.

Selected by `app.py` when `OPENAI_API_KEY` is unset. Uses the
openai-agents SDK's public testing helper (`agents.testing.ScriptedModel`).

Every model call is classified from the conversation it
receives (the same rules a real model follows, scripted):

- a `refund` function_call already in the conversation → the approval
  decision landed; emit the closing text (refunded, or not if denied).
- no tool history at all → first turn: text + `lookup_order` call.
- otherwise → a user message mentioning "refund" emits the gated
  `refund` call (→ approval pause); anything else closes the lookup turn.
"""

from __future__ import annotations

import os
from typing import Any

from agents import (
    OpenAIChatCompletionsModel,
    set_default_openai_client,
    set_tracing_disabled,
)
from agents.testing import ModelStep, ScriptedModel
from openai import AsyncOpenAI
from openai.types.responses import ResponseFunctionToolCall, ResponseOutputMessage

__all__ = ["setup_model"]


def _message(text: str, mid: str) -> ResponseOutputMessage:
    return ResponseOutputMessage(
        id=mid,
        type="message",
        role="assistant",
        status="completed",
        content=[{"type": "output_text", "text": text, "annotations": []}],  # type: ignore[list-item]
    )


def _call(cid: str, name: str, args: str) -> ResponseFunctionToolCall:
    return ResponseFunctionToolCall(
        id=f"fc_{cid}", type="function_call", call_id=cid, name=name, arguments=args
    )


def _is_refund_call(item: Any) -> bool:
    return (
        isinstance(item, dict)
        and item.get("type") == "function_call"
        and item.get("name") == "refund"
    )


def _classify(call: Any):
    """ModelResponder: pick the scripted step from the conversation."""
    items = call.input if isinstance(call.input, list) else []
    if any(_is_refund_call(i) for i in items):
        if "not approved" in str(items[-1]):
            return [_message("Okay — I won't refund order 123.", "m_close")]
        return [_message("Refund processed — anything else?", "m_close")]
    if not any(isinstance(i, dict) and i.get("type") == "function_call" for i in items):
        return [
            _message("Let me check that order.", "m1"),
            _call("c_lookup", "lookup_order", '{"order_id": "123"}'),
        ]
    last_user = next(
        (i for i in reversed(items) if isinstance(i, dict) and i.get("role") == "user"),
        {},
    )
    if "refund" in str(last_user.get("content", "")):
        return [_call("c_refund", "refund", '{"order_id": "123"}')]
    return [_message("Good news — order 123 shipped!", "m2")]


class _PerCallModel(ScriptedModel):
    """ScriptedModel that classifies EVERY model call from the conversation
    it receives (the constructor consumes its step list eagerly, and the
    agentic loop calls the model once per turn — a fixed step list can't
    cover multi-turn runs)."""

    async def _next_resolved_step(self, call: Any) -> ModelStep:
        return self._coerce_step(_classify(call), 0)


def setup_model():
    if api_key := os.environ.get("OPENAI_API_KEY"):
        client = AsyncOpenAI(api_key=api_key)
        set_default_openai_client(client, use_for_tracing=False)
        set_tracing_disabled(disabled=True)
        return OpenAIChatCompletionsModel(
            model="gpt-4o-mini",
            openai_client=client,
        )
    else:
        return _PerCallModel()
