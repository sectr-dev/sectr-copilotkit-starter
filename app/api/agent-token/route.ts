import { cookies } from "next/headers";

// Mints a Sectr user token (sks_…) for the signed-in user. This is the only
// place the invocation key is used — it never reaches the browser. The token
// can only see conversations owned by `external_user_id`.
export async function GET() {
  // `sectr dev` needs no auth: run without a key locally.
  if (!process.env.SECTR_INVOCATION_KEY) return Response.json({ token: null });

  // Your app's user id goes here (this sample: proxy.ts's anonymous cookie).
  const userId = (await cookies()).get("uid")?.value;
  if (!userId) return Response.json({ error: "not signed in" }, { status: 401 });

  // SECTR_AGUI_URL = https://api.sectr.dev/ag-ui/<app>/<route>
  const agui = new URL(process.env.SECTR_AGUI_URL!);
  const res = await fetch(new URL("/tokens", agui), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SECTR_INVOCATION_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ app: agui.pathname.split("/")[2], external_user_id: userId }),
  });
  if (!res.ok) return Response.json({ error: await res.text() }, { status: 502 });
  const { token } = await res.json();
  return Response.json({ token });
}
