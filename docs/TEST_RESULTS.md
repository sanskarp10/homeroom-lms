# Test results

Measured on 13 November 2026 in a small Linux container: **1 vCPU**, 3 GB RAM, Node.js 22, MongoDB 8, Redis 8,
FFmpeg 7.0.2 (the bundled `ffmpeg-static` build). A laptop is several times faster, mostly for transcoding.

## 1. API and unit tests: 45 of 45 pass

```bash
npm test
```

The suite boots the real Express app and Socket.IO server against a real MongoDB and runs the real FFmpeg pipeline.
Nothing is mocked.

```
 Test Files  2 passed (2)
      Tests  45 passed (45)
   Duration  7.25s
```

| Area | Tests | What is proven |
| --- | --- | --- |
| Health and auth | 4 | Drivers reported; duplicate email and weak password rejected; nobody can self-register as admin; wrong password and missing token give 401 |
| Course builder | 9 | Students cannot create courses; another instructor cannot edit yours; quiz validation; publish is blocked until every video is ready; non-video uploads rejected; **a real upload is transcoded to 360p + 720p HLS by the background job**, the playlists and segments are served with the right content types, and temp files are cleaned up; reordering persists |
| Access control | 4 | Public pages never contain quiz answers; preview lessons are open to all; other lessons return 403 until enrolled; paid courses cannot be joined for free |
| Payments | 3 | Declined card (402), expired card (400), somebody else's order (403), successful test payment; **80/20 split stored on the order**; paying twice enrolls once; the sale appears on the instructor dashboard and not on anyone else's |
| Progress, quizzes, certificates | 8 | Resume position saved; video completes at 90%; quiz answers hidden from learners; **auto-grading** of a failed attempt (25%) with explanations and of a passing attempt (100%); finishing the course issues exactly one certificate; **PDF** is valid and verifiable by ID |
| Live classes | 3 | Only the course owner can schedule and start; outsiders and invalid tokens are refused; students wait until the class is live; **WebRTC offers are relayed only to the addressed peer**; presence, raise hand, chat persistence, mute-all and end-class all propagate |
| Admin | 5 | Closed to other roles; platform totals correct; role change and disable take effect on the next request; archiving hides a course but keeps buyers' access; courses with students cannot be deleted |
| Unit | 9 | Grading rules (no partial credit, threshold edge), revenue split never loses a cent, the rendition ladder never upscales, helpers |

## 2. Browser journeys: 11 of 11 pass

```bash
python3 scripts/e2e_smoke.py http://localhost:4000 sample.mp4
```

Real Chromium (Playwright) against the production build, with MongoDB and **Redis + BullMQ** active.
The live class step uses two separate browser contexts and Chromium's fake camera and microphone.

```
PASS  catalog search finds a course  (1.3s)
PASS  free preview video streams over HLS without signing in  (0.8s)
PASS  checkout: declined card is rejected, test card enrolls the student  (1.3s)
PASS  player: HLS video plays with a quality menu, article completes  (1.2s)
PASS  quiz: wrong answers fail with explanations, a retake passes  (1.1s)
PASS  finishing every lesson issues a PDF certificate  (2.9s)
PASS  instructor creates a course with a reading and a quiz  (3.3s)
PASS  video upload is transcoded by the background worker and becomes streamable  (7.5s)
PASS  publish is blocked until the checklist passes, then goes live  (0.9s)
PASS  live class: two browsers exchange audio/video over WebRTC, chat and raise hand work  (8.3s)
PASS  admin sees platform totals and can search people  (1.3s)

11/11 journeys passed; no uncaught page errors
```

The WebRTC step asserts that each browser has a remote `<video>` whose stream carries an audio track and is
decoding frames (`videoWidth > 0`), so media really flows peer to peer, not just signalling.

## 3. Performance numbers

### API latency

Sequential requests against the seeded database (12 courses, 52 lessons, 202 enrollments, 135 orders), API and
database on the same single core.

| Endpoint | Requests | p50 | p95 | p99 |
| --- | --- | --- | --- | --- |
| `GET /api/courses` (catalog page of 12) | 300 | 7.2 ms | 14.9 ms | 23.4 ms |
| `GET /api/courses/:slug` (detail, curriculum, live classes) | 300 | 8.6 ms | 18.0 ms | 24.7 ms |
| `GET /api/live/schedule` | 300 | 6.8 ms | 19.3 ms | 27.4 ms |
| `GET /api/instructor/dashboard?days=90` (7 aggregations) | 200 | 36.6 ms | 63.8 ms | 86.7 ms |
| `GET /media/.../master.m3u8` (local HLS) | 300 | 1.2 ms | 3.5 ms | 5.5 ms |

### Video pipeline

| Measurement | Result |
| --- | --- |
| Upload request returns (4.8 MB file) | 87 ms. Transcoding continues in the background |
| 6 s 720p clip to 360p + 720p HLS + poster (`ultrafast`) | 1.8 s end to end, about 3.3x faster than real time for two renditions on one core |
| 8 s 720p clip through Redis + BullMQ, from "choose file" to "Ready to stream" in the browser (`veryfast`) | 7.5 s including upload and UI polling |
| Demo seed: three clips (74 s of 720p video) to 360p + 720p | about 60 s on one core |
| Output | 4-second segments, keyframe every 2 s, H.264 Main + AAC; 360p at about 0.8 Mbit/s, 720p at about 2.8 Mbit/s, 1080p at about 5 Mbit/s when the source allows |

### Realtime and documents

| Measurement | Result |
| --- | --- |
| WebRTC signalling relay, client to client through the server | 0.63 ms on loopback |
| Two-browser class: start, join, media both ways, chat, raise hand, end | 8.3 s for the whole journey on localhost |
| Certificate PDF generation (A4 landscape, 3.2 KB) | 42 ms, streamed, not stored |

### Frontend bundle (production build)

| Chunk | Size | Gzip |
| --- | --- | --- |
| App shell: React, Redux Toolkit, router, home, catalog, course page | 194 KB | 62 KB |
| Icons runtime | 94 KB | 31 KB |
| CSS | 51 KB | 12 KB |
| hls.js, loaded only when a video is shown | 578 KB | 180 KB |
| Live room (Socket.IO client + WebRTC), loaded only in a class | 68 KB | 21 KB |
| Every other page | 1 to 34 KB each | |

## 4. Fallback paths

| Scenario | Result |
| --- | --- |
| No MongoDB and no Redis reachable | API starts with `database: embedded`, `queue: inline`; registration and video upload work |
| Placeholders left in `server/.env` | Treated as unset; `storage: local`, `payments: test` |
| `npm run doctor` on the default local setup | 7 PASS, 3 WARN (storage, payments, TURN fallbacks), 0 FAIL |

## Not covered by automated tests

- S3, CloudFront and Stripe calls need real credentials. They are exercised by `npm run doctor` and the manual checklist in `SETUP_GUIDE.md` step B11.
- Live classes were tested with 2 participants on one machine. Behaviour across real networks depends on STUN/TURN.
