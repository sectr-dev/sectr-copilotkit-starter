import { NextResponse, type NextRequest } from "next/server";

// Stand-in for your app's auth: this sample has no login, so every browser
// gets an anonymous user id cookie. Each page also gets a conversation
// (?thread=…): the conversation lives on Sectr, the URL just names it, so a
// refresh lands back in the same session. Sectr thread ids are UUIDs, so a
// missing or malformed one starts a fresh conversation.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const response = UUID.test(url.searchParams.get("thread") ?? "")
    ? NextResponse.next()
    : NextResponse.redirect(new URL(`/?thread=${crypto.randomUUID()}`, url));
  if (!request.cookies.has("uid")) {
    response.cookies.set("uid", crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = { matcher: "/" };
