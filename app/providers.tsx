"use client";

import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // One user token per page load (valid 24h): no refresh logic needed.
  const [token, setToken] = useState<string | null>();
  useEffect(() => {
    fetch("/api/agent-token")
      .then((r) => r.json())
      .then((body) => setToken(body.token));
  }, []);
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
