# Deployment

Docker Compose on openclaw-staging:
```bash
cd /opt/connect
docker compose up -d
docker compose logs -f connect
```

## Endpoints
- Webhook server: `http://localhost:3080` / `https://connect.turbial.com`
- Agent API: `http://localhost:8787` / `https://connect.turbial.com/api/`

## Container Env
`.env` file in container root. Currently set: Supabase URL + anon key + agent API key.
