"""Deterministic scripted model — the key-free answerer.

Selected by `app.py` when `OPENAI_API_KEY` is unset. Uses the
openai-agents SDK's public testing helper (`agents.testing.ScriptedModel`).

Every model call is classified from what it must answer, the
conversation's last item (the same rules a real model follows, scripted),
so each message behaves the same however long the conversation is:

- a `refund` result → the approval decision landed; emit the closing
  text (refunded, or not if denied).
- a `lookup_order` result → the lookup returned; report it.
- a user message mentioning "refund" → the gated `refund` call
  (→ approval pause); any other message → text + a `lookup_order` call.

Tool-call ids carry the conversation length, so they stay unique across a
thread (as a real model's do).
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


def _classify(call: Any):
    """ModelResponder: pick the scripted step from the conversation's last item."""
    items = call.input if isinstance(call.input, list) else []
    last = items[-1] if items and isinstance(items[-1], dict) else {}
    if last.get("type") == "function_call_output":
        tool = next(
            (
                i.get("name")
                for i in items
                if isinstance(i, dict)
                and i.get("type") == "function_call"
                and i.get("call_id") == last.get("call_id")
            ),
            None,
        )
        if tool == "refund":
            if "not approved" in str(last.get("output")):
                return [_message("Okay — I won't refund order 123.", "m_close")]
            return [_message("Refund processed — anything else?", "m_close")]
        return [_message("Good news — order 123 shipped!", "m2")]
    n = len(items)
    if "refund" in str(last.get("content", "")).lower():
        return [_call(f"c_refund_{n}", "refund", '{"order_id": "123"}')]
    return [
        _message("Let me check that order.", "m1"),
        _call(f"c_lookup_{n}", "lookup_order", '{"order_id": "123"}'),
    ]


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
