"""Deterministic scripted chat model for the LangGraph route — the
key-free answerer.

Selected by `support_graph.py` when `OPENAI_API_KEY` is unset. A plain
LangChain `BaseChatModel` (LangGraph runs against any chat model) with the
same rules as fake.py. Every model call is classified from what it must
answer, the conversation's last message, so each message behaves the same
however long the conversation is:

- a `refund` result → the approval decision landed; emit the closing
  text (refunded, or not if denied).
- a `lookup_order` result → the lookup returned; report it.
- a user message mentioning "refund" → the gated `refund` call
  (→ approval pause); any other message → text + a `lookup_order` call.

Tool-call ids carry the conversation length, so they stay unique across a
thread (as a real model's do). Like a real provider, the model rejects a
conversation holding an unanswered tool call.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    ToolMessage,
)
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult

__all__ = ["ScriptedChatModel"]

Reply = tuple[
    str, list[tuple[str, str, dict[str, Any]]]
]  # (text, [(call_id, name, args)])


def _check_answered(messages: list[BaseMessage]) -> None:
    pending: list[str] = []
    for m in messages:
        if isinstance(m, ToolMessage):
            if m.tool_call_id in pending:
                pending.remove(m.tool_call_id)
            continue
        if pending:
            raise ValueError(
                f"tool calls {pending} are unanswered before the next message"
            )
        if isinstance(m, AIMessage) and m.tool_calls:
            pending = [str(c["id"]) for c in m.tool_calls]
    if pending:
        raise ValueError(
            f"tool calls {pending} are unanswered at the end of the conversation"
        )


def _classify(messages: list[BaseMessage]) -> Reply:
    _check_answered(messages)
    last = messages[-1] if messages else None
    if isinstance(last, ToolMessage):
        tool = next(
            (
                c["name"]
                for m in messages
                if isinstance(m, AIMessage)
                for c in m.tool_calls
                if c["id"] == last.tool_call_id
            ),
            None,
        )
        if tool == "refund":
            if "not approved" in str(last.content):
                return "Okay — I won't refund order 123.", []
            return "Refund processed — anything else?", []
        return "Good news — order 123 shipped!", []
    n = len(messages)
    if isinstance(last, HumanMessage) and "refund" in str(last.content).lower():
        return "", [(f"c_refund_{n}", "refund", {"order_id": "123"})]
    return "Let me check that order.", [
        (f"c_lookup_{n}", "lookup_order", {"order_id": "123"})
    ]


class ScriptedChatModel(BaseChatModel):
    @property
    def _llm_type(self) -> str:
        return "sectr-scripted"

    def bind_tools(self, tools: Any, **kwargs: Any) -> Any:
        return self  # the script already knows which tools exist

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Any = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> ChatResult:
        text, calls = _classify(messages)
        message = AIMessage(
            content=text,
            tool_calls=[
                {"id": i, "name": n, "args": a, "type": "tool_call"}
                for i, n, a in calls
            ],
        )
        return ChatResult(generations=[ChatGeneration(message=message)])

    async def _astream(  # type: ignore[override]
        self,
        messages: list[BaseMessage],
        stop: Any = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        # Stream like a real provider: text word by word, then each tool
        # call's arguments in two chunks.
        text, calls = _classify(messages)
        words = text.split(" ") if text else []
        for i, word in enumerate(words):
            yield ChatGenerationChunk(
                message=AIMessageChunk(
                    content=word + (" " if i < len(words) - 1 else "")
                )
            )
        for index, (call_id, name, args) in enumerate(calls):
            raw = json.dumps(args)
            half = len(raw) // 2
            yield ChatGenerationChunk(
                message=AIMessageChunk(
                    content="",
                    tool_call_chunks=[
                        {
                            "name": name,
                            "args": raw[:half],
                            "id": call_id,
                            "index": index,
                        }
                    ],
                )
            )
            yield ChatGenerationChunk(
                message=AIMessageChunk(
                    content="",
                    tool_call_chunks=[
                        {"name": None, "args": raw[half:], "id": None, "index": index}
                    ],
                )
            )
        yield ChatGenerationChunk(
            message=AIMessageChunk(content="", chunk_position="last")
        )
