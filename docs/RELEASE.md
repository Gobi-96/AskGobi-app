# Curiosity playground: release and rollback

## Current state and release gates

The feature is implemented on `feat/curiosity-playground` in the isolated worktree.
The production home computer has not been accessed. Its OS, application directory,
service manager, tunnel origin, model configuration, and restart commands are not
documented in the original repo. Do not guess those values or replace its hosting.
Production has not been changed.

**Security gate:** the inherited lockfile audit reports 11 production dependency
findings: 1 critical, 8 high, 2 moderate. Next.js is pinned to 14.2.5.
The registry proposes 14.2.35 as an in-line update, but its newer advisories also
affect 14.x; an in-line patch alone does not clear the release gate. Review and
upgrade to a supported patched Next.js line, update affected dependencies, and
repeat the full test/build/browser checks before exposing this release publicly.
No major framework migration was silently included in the playground change.

**Search gate:** the existing search Worker returned HTTP 200 with an empty
`results` array during local verification. The app discloses unavailable sources,
but a tiny model may still produce obsolete claims. Verify the search backend on
the host before presenting web search as working. Do not treat model completion
as proof that an answer is correct or current.

## Preparing the commit and host test

- Commit the feature source, regression tests, social image, configuration example,
  and additive SQL migration together. The root page and stream protocol changed
  together; do not cherry-pick only the new UI.
- Local environment files, dependencies, build outputs, installed Ollama binaries,
  and downloaded models do not belong in Git. Mac Finder metadata is removed.
- No credentials or host-specific startup scripts are supplied by this change.
  Keep the host's existing private environment; do not overwrite it with a blank
  example file. A standard Ollama installation often uses port 11434, whereas this
  app's existing default is 11435. Set `OLLAMA_PORTS` explicitly for your host.
- A commit/merge is not a production release approval. If merging or pulling main
  automatically restarts the public service, test in a separate checkout instead.
- Before switching the public tunnel, resolve the security gate, verify the
  existing account flows, and complete the host smoke checks below.

## Local development

Use Node 22 LTS or newer (AbortSignal.any and modern fetch are required).
Install with `npm ci`. Copy the example environment file to a private local
environment file and fill only the settings you need.

- `npm run dev -- --hostname 127.0.0.1 -p 3100`: local preview.
- `NEXT_BUILD_DIR=.next-dev npm run dev -- --hostname 127.0.0.1 -p 3100`: macOS/Linux preview isolated from release output.
- `npm test`: unit and server integration tests with synthetic model responses.
- `npm run typecheck`: TypeScript validation.
- `npm run build`: production build.
- `npm start -- --hostname 127.0.0.1`: serve the build on port 3000.

No real Ollama connection is required for the activity deck or automated tests.
No Supabase secret is needed for public play. Without a model, AI requests show
an offline message; they never substitute a canned success response.

## Keep the current hosting

1. Obtain the home server's hostname/login method from its owner. Inspect its
   actual startup service, working directory, environment variable **names**,
   running Node version, Cloudflare ingress, and local Ollama model inventory.
   Do not print credentials or full environment contents.
2. Record the active release revision, its exact startup/restart procedure,
   tunnel origin port, and the previous build directory. Preserve that entire
   release with its matching dependencies and environment securely.
3. Build the new revision in a separate sibling release directory on the target
   platform; do not copy this Mac's node_modules or .next output to a different OS.
   Keep the same private configuration and existing model. Use one Node process:
   rate limits and generation queue are process-local.
4. Bind a staging `next start` process to loopback on a spare, explicitly chosen
   port. Confirm `/`, a shared card, `/chat`, and streaming against the actual
   model. Never use `next dev` behind the public tunnel.
5. Verify the origin cannot be accessed directly before setting
   `TRUST_CLOUDFLARE_PROXY=true`. It trusts only `CF-Connecting-IP`, not arbitrary
   forwarded headers. IP-derived rate keys exist in process memory for at most
   the request window and are not logged or persisted.
6. Only after security and smoke tests pass, switch the existing supervisor or
   tunnel to the new release using the recorded procedure. Do not create a new
   hosting provider, domain, model service, or public data store.

## Supabase and authentication

- Keep the current public URL/anon key and existing history schema.
- Root callback URLs remain valid: the homepage forwards auth fragments to
  `/chat`, where the existing token consumer runs and removes the fragment.
  No new callback allowlist entry is required for the retained root callback.
- Exercise an actual test account: sign in, reopen an existing conversation,
  create/rename a project, regenerate a response, sign out, and verify private
  history is no longer visible. This requires the owner's configured test setup.
- For telemetry, run `supabase/curiosity_events.sql` once and configure the
  service-role key server-side. Never put it in a NEXT_PUBLIC variable.
- Anonymous/authenticated database clients have no direct table or RPC access.
  Only the server increments daily allowlisted event counters. Failure or missing
  configuration is a no-op for visitors. The migration is additive; no existing
  chat tables or policies are modified.
- Verify SQL grants and concurrent increments in staging before enabling telemetry.

## Smoke-test checklist

- At 360px and desktop sizes: no horizontal overflow, readable contrast in both
  themes, visible focus rings, 44px+ primary controls, usable on-screen keyboard.
- One tap starts a card; reveal/answer completes it; repeat completion never
  increases the distinct-card count. Reload retains device milestones.
- The daily card changes at midnight UTC. Random cards do not repeat until the
  session deck is exhausted. Unknown share IDs safely show the homepage.
- Card shares contain only a stable card ID. Challenge shares contain a milestone
  and a generic challenge link, never the entered question or model response.
- Model-offline, busy, interrupted, and stopped requests show no verdict controls
  and award no Challenger badge. Stop cancels upstream work.
- Challenge requests never search or include history, even if hand-written API
  calls attempt to supply it. Ordinary chat keeps explicit/automatic web search.
- Check root and representative riddle/fact social metadata; detail cards must
  not inherit the generic social image.

## Rollback

Switch the recorded service/tunnel origin back to the retained previous release
and restart using its recorded procedure. Do not reset the repo or remove user
data. Keep the additive telemetry table; it is harmless to the prior release.
Remove the server telemetry key if disabling telemetry entirely. Never roll back
to a known-vulnerable build as a substitute for completing the security gate.

## First-week review

Run this read-only query in Supabase:

```sql
select day, event, count
from public.curiosity_daily_events
where day >= (now() at time zone 'UTC')::date - 7
order by day, event;
```

Compare activity_complete/activity_start and challenge_complete/challenge_start;
these are event ratios, not unique-user conversion. Share intent means a share
button was tapped, not that a share completed. Verdicts are self-reported.
Combine counts with content-free operational log events `ask_finished` and
`ask_failed` for completion/error rates and duration percentiles. No automatic
first-week monitor has been scheduled, because the release date is not yet known.

The home server still determines site uptime. Curated cards work during a model
outage as long as the website itself is reachable.
