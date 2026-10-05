import { ChatPage } from "./chat-page";

// The OpenAI Agents SDK agent (route /chat_oai).
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ thread: string }>;
}) {
  const { thread } = await searchParams; // set by proxy.ts
  return <ChatPage path="/" thread={thread} />;
}
