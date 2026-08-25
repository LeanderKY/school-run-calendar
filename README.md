# Mein Kalender

Mobile-first school + run calendar. Static frontend is GitHub Pages compatible.

## Cloud sync / MCP
The `worker/` directory contains a Cloudflare Worker + D1 backend. It exposes the same calendar data through REST for the browser and MCP at `/mcp` for AI clients.

See `worker/README.md` for deployment. Keep `CALENDAR_TOKEN` in Cloudflare Secrets — never commit it.
