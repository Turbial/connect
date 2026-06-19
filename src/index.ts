import "dotenv/config";
import http from "node:http";
import { supabase } from "./lib/supabase.js";
import { handleSmsReply } from "./approval/index.js";

/** Minimal webhook receiver for inbound Twilio SMS replies (YES/NO/EDIT). */
const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/webhooks/sms") {
    res.writeHead(404).end();
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;
  const params = new URLSearchParams(body);
  const from = params.get("From");
  const text = params.get("Body");

  if (!from || !text) {
    res.writeHead(400).end();
    return;
  }

  const { data: business, error } = await supabase
    .from("business")
    .select("id")
    .eq("owner_phone", from)
    .maybeSingle();

  if (error || !business) {
    res.writeHead(404).end();
    return;
  }

  await handleSmsReply(business.id, text);
  res.writeHead(200, { "Content-Type": "text/xml" }).end("<Response></Response>");
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Distribution Layer listening on :${port}`));
