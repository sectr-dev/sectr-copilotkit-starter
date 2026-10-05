import Link from "next/link";
import { Chat } from "./chat";

// One page per agent: the same chat, pointed at a different Sectr route.
const AGENTS = [
  { href: "/", agentId: "default", label: "OpenAI Agents SDK" },
  { href: "/langgraph", agentId: "langgraph", label: "LangGraph" },
];

export function ChatPage({ path, thread }: { path: string; thread: string }) {
  const current = AGENTS.find((a) => a.href === path)!;
  return (
    <main>
      <h1>Your App</h1>
      {/* A thread belongs to one route, so switching agents starts a new
          conversation: these links carry no ?thread=. */}
      <nav className="agents">
        {AGENTS.map((a, i) => (
          <span key={a.href}>
            {i > 0 && " · "}
            {a === current ? (
              <strong>{a.label}</strong>
            ) : (
              <Link href={a.href} prefetch={false}>
                {a.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <p>
        Ask the support agent about order 123, then ask it to refund it.{" "}
        <Link href={path} prefetch={false}>
          New chat
        </Link>
      </p>
      <Chat agentId={current.agentId} threadId={thread} />
    </main>
  );
}
