# Test results

## Current verification — 24 November 2026

| Check | Result |
| --- | --- |
| `npm test` | **46/46 passing** (2 files: 36 API + 10 unit) |
| `npm run build` | **PASS** — Vite production bundle |
| `npm run doctor` | **OK** — 5 PASS, 5 WARN, 0 FAIL; warnings are the documented local fallbacks |
| Latest commit | `ea55b93 fix: show cancellation notice when leaving local checkout` |

The automated suite boots the real Express app, uses an isolated `homeroom_test` database and exercises the real FFmpeg pipeline. It does not touch the demo database. `npm run doctor` reports embedded MongoDB, inline queue, local storage, test payments and no TURN in the current local environment; these are expected development fallbacks.

## Browser QA phases A–G

Structured reports and screenshots are in `%LOCALAPPDATA%\Temp\opencode\browser-audit\`; a curated image set is in `docs/screenshots/`.

| Phase | Area | Result |
| --- | --- | --- |
| A | Authentication and role navigation | 16/16 PASS |
| B | Student learning workflow | Initially harness-limited; `phase-b-resume.json` and `phase-b-final.json` completed enrolment, playback, quizzes, certificate and verification — final state PASS |
| C | Instructor workflow | 18/18 PASS |
| D | Admin workflow | 20/20 PASS |
| E | Payment workflow | 29/30 initially; the one genuine defect was the local checkout “Back to the course” link omitting `?checkout=cancelled`. Fixed in `ea55b93` and re-verified in the browser |
| F | Live classes | 31 PASS, 0 FAIL, 1 BLOCKED (server stdout/stderr not exposed) |
| G | Video/media reliability | 38 PASS, 0 FAIL, 4 BLOCKED, 1 NOT TESTED |

### Phase G detail

- Simulated permission cases: camera denied, microphone denied, both denied, both granted — all handled gracefully.
- Local audio/video tracks, toggles, peer senders and cleanup verified.
- Remote stream, correct participant tile, decoded frames and RTP packets verified:
  - inbound audio 24 packets, inbound video 22 packets, `framesDecoded=1`;
  - outbound audio 25 packets, outbound video 58 packets;
  - `connectionState=connected`, `iceConnectionState=connected`, `signalingState=stable`;
  - candidate type `host`; no relay candidates.
- Socket/network recovery, leave, rejoin and end verified.
- BLOCKED: no TURN configured; ICE failure could not be induced safely; physical devices unavailable; server logs unavailable.
- NOT TESTED: device switching is not implemented.

## Security and reliability review outcome

| Finding | Status |
| --- | --- |
| Local checkout cancellation notice missing | Fixed and committed |
| Critical authentication/authorization defects | None found after browser and API verification |
| Payment/order manipulation | Role/ownership checks, test gateway and 80/20 split verified; no real payments used |
| CloudFront signed URLs | Known limitation, documented; not implemented |
| localStorage JWT / no server-side revocation | Known architectural trade-off, documented |
| In-memory live rooms / single instance | Known limitation, documented |
| TURN relay | Not configured locally; BLOCKED for strict-network testing |

## Historical performance measurements

The following numbers were measured on 13 November 2026 in a small Linux container (1 vCPU, 3 GB RAM, Node 22, MongoDB 8, Redis 8, bundled FFmpeg 7.0.2). They were not re-measured during the final sprint and are retained as indicative only.

| Measurement | Result |
| --- | --- |
| Catalog API p50 / p95 | 7.2 ms / 14.9 ms |
| Course detail API p50 / p95 | 8.6 ms / 18.0 ms |
| Instructor dashboard p50 / p95 | 36.6 ms / 63.8 ms |
| 6 s 720p clip to 360p + 720p HLS | 1.8 s |
| Certificate PDF generation | 42 ms, 3.2 KB |
| WebRTC signal relay loopback | 0.63 ms |
| Two-browser WebRTC class journey | 8.3 s |

## Not covered

- Real S3/CloudFront, Stripe live-mode, TURN and MongoDB Atlas credentials were not available.
- Physical camera/microphone and multi-instance Socket.IO scaling were not tested.
- No production URL was available, so no public-URL smoke test was performed.
