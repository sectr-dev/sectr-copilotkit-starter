import Link from "next/link";
import { Chat } from "./chat";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ thread: string }>;
}) {
  const { thread } = await searchParams; // set by proxy.ts

  return (
    <main>
      <h1>Your App</h1>
      <p>
        Ask the support agent about order 123, then ask it to refund it.{" "}
        <Link href="/" prefetch={false}>
          New chat
        </Link>
      </p>
      <Chat threadId={thread} />
    </main>
  );
}
