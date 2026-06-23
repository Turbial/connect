# Connect Roadmap

## Phase 1 — Command Router
- [ ] Extract command parser into mighty-core/messenger
- [ ] Wire intent classifier: "analyze this file" → Result, "follow up with John" → CRM
- [ ] Set missing env vars (Twilio, GBP, Stripe)

## Phase 2 — Multi-Provider
- [ ] Slack slash commands
- [ ] Telegram bot commands
- [ ] Email command parsing (forward email → action)
- [ ] Response formatting for each provider

## Phase 3 — Autonomous
- [ ] Agentic follow-up: user says "check on John" → agent queries CRM → reports back
- [ ] Scheduled actions via MightyFlow
- [ ] Approval prompts in chat
