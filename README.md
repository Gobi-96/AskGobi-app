# AskGobi · Curious? Apparently you are.

A mobile-first curiosity playground backed by the existing Next.js, local Ollama,
Cloudflare, and Supabase setup.

## What visitors can do

- Open a one-tap surprise: 10 riddles, 10 quizzes, and 10 sourced facts.
- Discover a daily card that changes at midnight UTC.
- Challenge a tiny local AI, then give a clearly self-reported verdict.
- Earn First Spark, Explorer, and Challenger milestones stored on their device.
- Share curated-card links or a milestone, without publishing private questions.
- Ask anything at `/chat`, with one-tap starters, optional sign-in, projects,
  and saved history.

## Development

Use Node 22 LTS or newer. Run `npm ci`, then copy `.env.local.example` to a private
`.env.local` file and configure the existing Ollama/Supabase settings as needed.

```sh
npm run dev
npm test
npm run typecheck
npm run build
npm start
```

For preview and production builds running together on macOS/Linux:

```sh
NEXT_BUILD_DIR=.next-dev npm run dev -- --hostname 127.0.0.1 -p 3100
```

The curated deck does not need an AI or database connection. Without Ollama,
challenges show an offline state. Authentication/history remain optional and
separate from public play. No paid inference API is required.

## Configuration

The active model comes from `OLLAMA_MODEL` (default `gemma2:2b`), on
`OLLAMA_HOST` plus the configured `OLLAMA_PORTS` (default 11435). Do not infer
production's model from this default: verify the home server's configuration.
Public copy intentionally says “tiny local AI,” not an unverified parameter count.

Supabase history uses the existing public URL and anon key. Aggregate telemetry is
optional: apply `supabase/curiosity_events.sql` and set the server-only service-role
key. No raw prompts, answers, locations, or persistent visitor identifiers are sent
to the event endpoint. Operational logs contain mode, duration, and outcome only.

Only enable `TRUST_CLOUDFLARE_PROXY` when direct access to the origin is blocked.
Use one Next.js process; the queue and request throttling are process-local.

## Tests and deployment

See [release instructions](docs/RELEASE.md) for rollout, rollback, authentication
checks, telemetry setup, and the first-week review. A known inherited dependency
security gate must be resolved before public rollout. The feature work does not
migrate hosting or replace the existing private chat database.

Automated tests use in-process synthetic responses and never download or start a
model. One-off local model runners and browser fixtures are not part of the source.
Install Ollama separately on the host and preserve its actual model/port settings.
