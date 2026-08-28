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

### Connect the Signal staged rollout

This revision replaces only the opening quiz with the visual puzzle. Older quiz-opening
checklist items below now apply to **More surprises**, not the default homepage.
No public DB, production host or tunnel has been changed by implementation.

1. Host-test **practice first**, with `SIGNAL_LEADERBOARD_ENABLED=false` and
   `SIGNAL_COACH_ENABLED=false`. Verify fresh solvable boards, exact shares,
   personal bests, resume, storage-denied play, curated cards, and existing chat/auth.
2. Apply `supabase/signal.sql` to a staging Supabase project. It adds only signal
   boards, hashed guest identities, daily bests and submission receipts. RLS is
   enabled; anon/authenticated access is revoked; service-role RPC access is explicit.
   Run the event migrations in order: curiosity_events → curiosity_builder_events
   → curiosity_signal_events, omitting ones already applied.
3. Configure server-only Supabase credentials and a stable random
   `SIGNAL_TICKET_SECRET` of at least 32 characters. Rotate only with the understanding
   that outstanding tickets become invalid. Never include it in a client environment.
4. Test simultaneous submissions for one guest with different move counts using
   **separate DB connections**; best result must win. Check duplicate/changed replay,
   mismatched guest claims, two-hour expiry, UTC midnight/week boundaries, ties,
   top-25 cap, and deletion while publishing is off. The isolated SQL suite is
   useful but does not reproduce concurrent PostgreSQL sessions or PostgREST grants.
5. Enable leaderboard publishing in staging. Browser-test first publication (no
   cookie beforehand), secure HttpOnly cookie, returning visitor, lost-response
   retry, same-initial discriminators, and deletion. Only server-confirmed rank is
   shown, as a snapshot. One participant gets “First entry”, not a competitive boast.
6. Separately enable coach explanations in staging. Verify the configured Ollama
   model returns suitable short JSON, the shared chat/coach queue stays bounded,
   Stop aborts upstream work, and the 20-second deadline includes queuing. Confirm
   model/DB outages retain solver hints and practice. No web search or saved-chat
   context may enter coaching. Disable either switch independently if needed.
7. Test phones at 360, 390 and 430px, tablets and the 1100px desktop breakpoint.
   Tile targets must exceed 48px; keyboard activation, screen-reader move/win
   announcements, non-colour cues, enlarged text and reduced motion need real-browser
   checks. Resizing/theme changes and midnight must preserve the active attempt.
8. Retain all existing security/search/account/host gates below. Five unfamiliar
   mobile visitors: at least four understand play within five seconds and complete
   practice without coaching. Two technical reviewers must find a decision and its
   test within one minute. Automated checks cannot satisfy these human gates.

The server validates at most 256 rotations and calculates points itself. A valid
move replay is not proof of unaided human play. Multiple guest identities and outside
assistance remain possible. No global rank or unique-visitor claim is inferred from
aggregate events. All-time totals intentionally reward participation as well as skill.

Removing a guest deletes initials and all daily scores. A receipt tombstone loses
its identity/alias but prevents the same ticket being reclaimed. Receipts older than
expiry plus 24 hours are cleaned on subsequent successful posts; without posts they
may remain longer, containing no deleted guest identifier or alias. Retain additive
tables on rollback; do not drop user data. Turn off both switches to revert to practice.

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

Use Node 24 LTS, matching CI (AbortSignal.any and modern fetch are required).
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
- For telemetry, run `supabase/curiosity_events.sql` once, then
  `supabase/curiosity_builder_events.sql` to extend both existing allowlists.
  Follow with `supabase/curiosity_signal_events.sql` for the five puzzle events.
  Existing installations need only unapplied migrations. Configure the
  service-role key server-side. Never put it in a NEXT_PUBLIC variable.
- Anonymous/authenticated database clients have no direct table or RPC access.
  Only the server increments daily allowlisted event counters. Failure or missing
  configuration is a no-op for visitors. The migration is additive; no existing
  chat tables or policies are modified.
- Verify SQL grants and concurrent increments in staging before enabling telemetry.

## Smoke-test checklist

- Check the desktop grid at 1100, 1280, 1440 and 1920 CSS pixels, and the stacked
  layout at 360, 390, 430, 768 and 1024. Verify the 1099/1100 boundary. Resize an
  answered quiz and an open challenge: question, feedback and draft must persist.
  Keep a single set of links and the activity → builder → contact keyboard order.
  Expand build details and discoveries; long content must scroll naturally without
  clipping or overlapping. Check both themes and enlarged text. Desktop header
  and footer align with the wider container; mobile spacing remains unchanged.

- Check every opening quiz at 360, 390 and 430px. At 360×640 the two-line welcome,
  question and all three answers should fit without navigation. Answer controls
  must be at least 48px tall. Also check desktop, enlarged text through normal
  scrolling, both themes, visible focus, and the on-screen keyboard.
- Opening the homepage directly displays a quiz, without an activity-start event
  or progress award. The first answer/reveal starts and completes that visit.
  “Surprise me” explicitly starts the next card; “Skip this one” also selects the
  next card but never completes the skipped activity or earns a milestone. Repeat
  completion never increases the distinct-card count. Reload retains milestones.
- Reopen the homepage repeatedly: each entry selects a random quiz, excluding
  locally remembered quizzes until all ten have appeared. The next cycle must not
  immediately repeat the last quiz. With storage blocked, play still works but
  repeat prevention cannot survive a reload. Leave an open question unchanged
  while answering, across midnight, and through theme/disclosure changes.
  Continuation uses the full 30-card session deck without repeats before exhaustion;
  opening visits can reset the quiz cycle independently. Shared IDs always override
  random selection; unknown IDs fall back to a random opening.
- Verify correct/incorrect feedback, keyboard focus after “Surprise me,” native
  disclosures, and storage-denied operation. Check the retained GitHub/LinkedIn
  profile URLs. Open build details repeatedly: only the first open per page entry
  counts. Contact clicks measure intent only. Simulate failed telemetry; play and
  navigation must continue normally.
- Ask five unfamiliar people to use their phones. Without guidance, at least four
  should identify what to do within five seconds and find how to contact Gobi.
  Observe voluntary second/third activities and whether they remember Gobi.
  Ask two technical reviewers to find one engineering decision and its supporting
  code within a minute. Record observations; automation cannot satisfy these gates.
- Verify keyboard-only use, screen-reader announcements and reduced-motion behavior
  in real browsers. Test hosted production mobile performance: LCP ≤2.5s, INP ≤200ms,
  CLS ≤0.1 are goals, not measurements already achieved. Local bundle size is not
  evidence of hosted performance or field Core Web Vitals.
- Open challenges both through the secondary link and `/?challenge=1`; confirm
  their lazy-loaded interface, model-offline recovery, and return to activities.
- Confirm the README screenshot and direct code/test links. The read-only GitHub
  workflow runs tests, TypeScript and build without production secrets or deployment.
  Do not add a passing badge until a real GitHub run succeeds.
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
also inspect puzzle_complete/puzzle_start and puzzle_replay as event counts,
with leaderboard_post and coach_use kept separate from guest score records.
these are event ratios, not unique-user conversion. Share intent means a share
button was tapped, not that a share completed. Verdicts are self-reported.
Review `build_details_open` and `contact_intent` as aggregate interaction counts,
not unique visitors, confirmed leads, or conversations. Initial displayed quizzes
are not starts, so the new completion/start ratio is not comparable to the prior
homepage without noting the change in event semantics. Daily counts cannot track
individual visitor journeys or whether a particular person contacted Gobi.
Combine counts with content-free operational log events `ask_finished` and
`ask_failed` for completion/error rates and duration percentiles. No automatic
first-week monitor has been scheduled, because the release date is not yet known.

The home server still determines site uptime. Curated cards work during a model
outage as long as the website itself is reachable.
