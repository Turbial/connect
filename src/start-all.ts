import "dotenv/config";
import { startWebhookServer } from "./index.js";
import { startAgentApiServer } from "./agent-api/server.js";

/** Single-process entrypoint running both the webhook server (Twilio/Reach
 * inbound webhooks) and the agent API/dashboard server side by side, so a
 * single deployed service exposes both surfaces. */
startWebhookServer(Number(process.env.PORT ?? 3000));
startAgentApiServer(Number(process.env.AGENT_API_PORT ?? 8787));
