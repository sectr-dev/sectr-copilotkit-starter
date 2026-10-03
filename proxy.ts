import { NextResponse, type NextRequest } from "next/server";

// Stand-in for your app's auth: this sample has no login, so every browser
// gets an anonymous user id cookie. Each page also gets a conversation
// (?thread=…): the conversation lives on Sectr, the URL just names it, so a
// refresh lands back in the same session.
export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const response = url.searchParams.has("thread")
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
