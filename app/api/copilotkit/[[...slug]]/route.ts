import { HttpAgent } from "@ag-ui/client";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";

// Your agent, deployed on Sectr. SECTR_AGUI_URL is the AG-UI endpoint that
// `sectr dev` / `sectr deploy` prints. The browser's `Authorization` header
// (the user token from /api/agent-token) is forwarded to Sectr by the Runtime.
const sectrAgent = new HttpAgent({
  url: process.env.SECTR_AGUI_URL!,
});

const runtime = new CopilotRuntime({
  agents: { default: sectrAgent },
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
