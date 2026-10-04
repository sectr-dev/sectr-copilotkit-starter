"use client";

import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // One user token per page load (valid 24h; a tab open longer must reload).
  const [token, setToken] = useState<string | null>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    fetch("/api/agent-token")
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
        setToken(body.token);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <main>
        <h1>Couldn&apos;t get a Sectr user token</h1>
        <p>
          <code>/api/agent-token</code> failed: {error}
        </p>
        <p>
          Check <code>SECTR_AGUI_URL</code> and <code>SECTR_INVOCATION_KEY</code> (see the README).
        </p>
      </main>
    );
  }
  if (token === undefined) return null;

  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      headers={token ? { Authorization: `Bearer ${token}` } : {}}
    >
      {children}
    </CopilotKitProvider>
  );
}
