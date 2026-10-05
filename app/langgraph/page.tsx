import { ChatPage } from "../chat-page";

// The same support agent on LangGraph (route /chat_langgraph).
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ thread: string }>;
}) {
  const { thread } = await searchParams; // set by proxy.ts
  return <ChatPage path="/langgraph" thread={thread} />;
}
