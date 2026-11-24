# Production QA plan and status

## Status

**BLOCKED — no deployed public URL exists.** The checks below are prepared but not executed against production. Local Phase A–G results are not evidence of production behaviour.

Full structured harness plan and prior baselines are in `%LOCALAPPDATA%\Temp\opencode\browser-audit\phase-*.json` and `docs/TEST_RESULTS.md`.

## Classification rules

- **PASS**: expected UI/API state observed on the public URL after explicit waits; data persists after refresh; no unexpected console/page errors or HTTP ≥400.
- **FAIL**: assertion mismatch, timeout, blank page, wrong role/ownership outcome, missing persistence, unexplained 5xx or console exception.
- **BLOCKED**: required precondition absent (public URL, test account, Stripe test config, TURN, physical device, platform logs). Do not mark PASS.

## Smoke checklist

| # | Scenario | Expected | Current status |
| --- | --- | --- | --- |
| 1 | `/api/health` and SPA root | 200; production fields correct; SPA shell renders | BLOCKED — no URL |
| 2 | Landing page and CTAs | Hero, Sign in, Join free work | BLOCKED |
| 3 | Nested route refresh | `/courses/:slug`, `/learn/...`, `/live/:id`, `/admin` reload correctly | BLOCKED |
| 4 | Student login and guards | `/learning` opens; `/teach` and `/admin` redirect | BLOCKED — no production account |
| 5 | Instructor login and guards | `/teach` opens; `/admin` blocked | BLOCKED |
| 6 | Admin login and guards | `/admin` opens; role checks 403 for others | BLOCKED |
| 7 | Catalogue and course detail | Published courses only; no quiz answers leaked | BLOCKED |
| 8 | Free preview and enrollment | Preview plays; free enrollment persists | BLOCKED — no free fixture |
| 9 | Video and progress | HLS plays; 90% completion persists | BLOCKED |
| 10 | Quiz | Wrong attempt explains; retake passes | BLOCKED |
| 11 | Certificate | Code, public verify page and PDF valid | BLOCKED |
| 12 | Payment config | `provider` matches health (`stripe` expected in production) | BLOCKED — no Stripe test key |
| 13 | Test checkout | Unlock after test payment; 80/20 split recorded | BLOCKED |
| 14 | Decline/cancel/idempotency | 402, cancellation banner, one enrollment | BLOCKED |
| 15 | Instructor course management | Create/edit/upload/publish/ownership | BLOCKED |
| 16 | Admin management | People/courses/status changes; temp account cleanup | BLOCKED |
| 17 | Live class create/waiting room | Schedule persists; student waits; outsider blocked | BLOCKED |
| 18 | Live join/chat/leave/end | Presence, chat, host controls, ended state | BLOCKED |
| 19 | Socket.IO stability | Auth required; reconnect rejoins | BLOCKED |
| 20 | Media with fake devices | Tracks, RTP counters, frames, cleanup | BLOCKED |
| 21 | Console/network sweep | No unexpected errors | BLOCKED |
| 22 | Platform logs | No unhandled 5xx/exceptions | BLOCKED — logs not available |

## Checks that remain BLOCKED even after deployment without extra inputs

- TURN relay candidate selection: requires configured TURN and a network that forces relay.
- Physical camera/microphone quality: requires hardware.
- Device switching: not implemented.
- Genuine ICE restart on `failed` state: failure injection is unsafe in QA.
- Multi-instance live rooms: current architecture requires one instance; scaling needs Redis adapter and shared room state.

## Evidence requirements

Each executed row must include HTTP status/body summary, CDP assertion value or screenshot, and aggregated console/page/network error state. Never include tokens, secrets or personal data in evidence files.
