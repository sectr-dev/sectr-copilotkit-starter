import { HttpAgent } from "@ag-ui/client";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { SectrRunner } from "@sectr/copilotkit";

// Your agent, deployed on Sectr. SECTR_AGUI_URL is the AG-UI endpoint that
// `sectr dev` / `sectr deploy` prints for the /chat_oai route. The browser's
// `Authorization` header (the user token from /api/agent-token) is forwarded
// to Sectr by the Runtime.
const aguiUrl = process.env.SECTR_AGUI_URL!.replace(/\/+$/, "");

// Every Sectr route is its own AG-UI endpoint, whatever the framework behind
// it: the LangGraph route is the sibling URL (…/support-agent/chat_oai →
// …/support-agent/chat_langgraph), so one env var configures both. To point
// an agent somewhere else, give its HttpAgent that URL instead.
const siblingUrl = (route: string) => aguiUrl.replace(/[^/]+$/, route);

const agents = {
  default: new HttpAgent({ url: aguiUrl }), // OpenAI Agents SDK
  langgraph: new HttpAgent({ url: siblingUrl("chat_langgraph") }),
};

// SectrRunner keeps this server stateless: conversations live on Sectr, and
// every read goes there with the user's token (@sectr/copilotkit). It gets
// the same agents map, to know where to reconnect a reloaded page.
const runtime = new CopilotRuntime({ agents, runner: new SectrRunner({ agents }) });

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
