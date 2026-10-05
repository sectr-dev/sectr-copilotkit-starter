// Smoke test against the agent's AG-UI endpoint: a full turn, an approval
// interrupt, the resume run that answers it, and connect (what a reloaded
// page gets back from Sectr).
//
//   SECTR_AGUI_URL=... [SECTR_INVOCATION_KEY=...] node scripts/smoke.mjs
//
// Without SECTR_INVOCATION_KEY it talks to `sectr dev` (no auth); with it, it
// mints a user token exactly like app/api/agent-token does.
import assert from "node:assert/strict";

const url = process.env.SECTR_AGUI_URL;
assert(url, "set SECTR_AGUI_URL");
const key = process.env.SECTR_INVOCATION_KEY;

const headers = { "Content-Type": "application/json" };
if (key) {
  const agui = new URL(url);
  const res = await fetch(new URL("/tokens", agui), {
    method: "POST",
    headers: { ...headers, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ app: agui.pathname.split("/")[2], external_user_id: "smoke-test" }),
  });
  const minted = await res.text();
  assert.equal(res.status, 201, `POST /tokens: ${res.status} ${minted}`);
  headers.Authorization = `Bearer ${JSON.parse(minted).token}`;
}

const threadId = crypto.randomUUID();
let n = 0;

/** POSTs one run and returns its AG-UI events. */
async function run(fields) {
  const body = { threadId, runId: `smoke-${++n}`, messages: [], tools: [], context: [], ...fields };
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  assert.equal(res.status, 200, `run ${n}: ${res.status} ${text}`);
  const events = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5)));
  assert.equal(events[0]?.type, "RUN_STARTED", `run ${n} starts with RUN_STARTED`);
  const last = events.at(-1);
  assert(last?.type === "RUN_FINISHED", `run ${n} ended with ${JSON.stringify(last)}`);
  console.log(`run ${n}: ${events.length} events → ${last.outcome.type}`);
  return events;
}

/** GETs a connect (a reloaded page) and returns its AG-UI events. */
async function connect(thread) {
  const res = await fetch(`${url}?threadId=${thread}`, { headers });
  const text = await res.text();
  assert.equal(res.status, 200, `connect: ${res.status} ${text}`);
  const events = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5)));
  console.log(`connect: ${events.length} events${events.length ? ` → ${events.at(-1).type}` : ""}`);
  return events;
}

const user = (content) => ({ messages: [{ id: crypto.randomUUID(), role: "user", content }] });

// 1. A full turn streams assistant text and ends successfully.
const turn = await run(user("Where is order 123?"));
assert(turn.some((e) => e.type === "TEXT_MESSAGE_CONTENT"), "assistant text streamed");
assert.equal(turn.at(-1).outcome.type, "success");

// 2. A gated tool pauses the run as an AG-UI interrupt.
const paused = await run(user("Please refund order 123."));
const outcome = paused.at(-1).outcome;
assert.equal(outcome.type, "interrupt", "refund needs approval");
const [interrupt] = outcome.interrupts;
assert.equal(interrupt.reason, "tool_approval");
assert.equal(interrupt.metadata.toolName, "refund");

// 3. A reload while it waits: connect replays the run, ending in the SAME
//    interrupt, so the page can show Approve/Deny again.
const reloaded = await connect(threadId);
assert.equal(reloaded[0].type, "RUN_STARTED");
assert.equal(reloaded[0].runId, "smoke-2", "connect replays the original run");
assert.equal(reloaded[1].type, "MESSAGES_SNAPSHOT");
assert.deepEqual(reloaded.at(-1).outcome, outcome, "the same interrupt comes back");

// 4. Answering it (deny) resumes the same turn, with the history snapshot.
const resumed = await run({ resume: [{ interruptId: interrupt.id, status: "resolved", payload: false }] });
assert(resumed.some((e) => e.type === "MESSAGES_SNAPSHOT"), "resume run carries the history");
assert.equal(resumed.at(-1).outcome.type, "success");

// 5. A reload after it: the resumed run, replayed. The snapshot ends at the
//    resume (it still holds the refund call); the reply streams after it.
const after = await connect(threadId);
assert.equal(after[0].runId, "smoke-3");
const calls = after[1].messages.flatMap((m) => m.toolCalls ?? []);
assert(calls.some((c) => c.function.name === "refund"), "snapshot holds the refund call");
assert(after.some((e) => e.type === "TEXT_MESSAGE_CONTENT"), "the reply is replayed");
assert.equal(after.at(-1).outcome.type, "success");

// 6. A brand-new thread has nothing to reconnect to: an empty stream.
assert.deepEqual(await connect(crypto.randomUUID()), []);

console.log(`ok — thread ${threadId}`);
