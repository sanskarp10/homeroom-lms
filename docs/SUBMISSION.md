# Submission guide

## 10-minute presentation structure

| Time | Section | What to show | Key points |
| --- | --- | --- | --- |
| 0:00–0:45 | Problem and scope | Home page and `README.md` | One application replaces catalog, video host, quiz tool, classroom and certificate issuer. Three roles. |
| 0:45–2:45 | Student journey | Sign in as Sam, open a course, free preview, buy a course with the test card, play video, complete a quiz | Resume position, 90% completion, server-side grading and explanations, instant enrolment. |
| 2:45–3:30 | Completion | Finish a free course, download certificate, open `/verify/<ID>` | PDF generated on demand; public verification by unguessable ID. |
| 3:30–5:15 | Instructor | Teach dashboard, course editor, add lesson/quiz, video upload status, publish, earnings | FFmpeg HLS pipeline, publish checklist, 80/20 revenue split stored per order. |
| 5:15–6:45 | Live class | Two browsers: schedule, waiting room, start, join, chat, raise hand, mute-all, end | WebRTC mesh; server only signs and relays; Socket.IO auth and room checks. |
| 6:45–7:45 | Admin | Admin dashboard, People search, role/status controls, course moderation | Role protection, platform analytics, ownership checks. |
| 7:45–8:45 | Architecture | `docs/ARCHITECTURE.md` diagram and data model | Driver fallbacks, lesson document as pipeline source of truth, keys not URLs. |
| 8:45–9:30 | Testing | `docs/TEST_RESULTS.md` and selected screenshots | 49/49 tests, browser phases A–G, known blocks honestly stated. |
| 9:30–10:00 | Limits and next steps | Known limits slide | Single-instance rooms, unsigned CDN URLs, mesh scaling, no payouts. |

## Recommended demonstration sequence

1. Start from `http://localhost:5173` with demo data loaded (`npm run dev`).
2. Sign in as `sam@homeroom.test` / `homeroom123`.
3. Open **Courses**, search, open a paid course, click **Buy this course**.
4. On checkout, use **Fill in the test card**, then **Pay**. The player opens.
5. Play a lesson; point out the quality selector and resume behaviour.
6. Complete the article, attempt the quiz incorrectly, review explanations, retake correctly.
7. Open **Certificates** and download/verify the PDF.
8. Sign in as `maya@homeroom.test`; open **Teach**. Show earnings and sales.
9. Open a course editor; show sections, lesson types, video status and publish state.
10. Open **Live classes** in instructor and student browsers; start, join, chat, raise hand and end.
11. Sign in as `admin@homeroom.test`; show totals, People and Courses moderation.

Keep the checkout flow clearly labelled **Test mode — no real money moves**.

## Individual contribution and reflection

This section must be completed by the student from their own experience. Do not fabricate contributions.

Suggested prompts:

- Which parts did I implement personally, and which files show that work?
- What did I learn about REST API design, state management, WebRTC signalling or media processing?
- Which bug was hardest to diagnose, and what evidence led to the fix?
- What would I change if given another week?

Example starting sentence to personalise:

> “The component I am most confident about is ___ because I designed and implemented ___. The main technical lesson was ___.”

## Key technical challenges and solutions

| Challenge | Approach |
| --- | --- |
| Long video uploads | Return 202 immediately, store pipeline state in the lesson, process in a queue, let the editor poll. |
| HLS with mixed sources | One FFmpeg run per rendition, no upscaling, hand-written master playlist. |
| WebRTC offer collisions | The later joiner always offers; camera/screen changes use `replaceTrack()` without renegotiation. |
| Reliable payments without real money | Built-in test gateway locally; Stripe test Checkout with redirect and webhook configured for production. |
| Duplicate fulfilment | Idempotent order fulfilment; paying twice does not create a second enrolment. |
| Zero-install local mode | Driver fallbacks for MongoDB, Redis, storage and payments selected by environment values. |
| Browser QA without Playwright locally | Reusable CDP harness with fake media devices and structured evidence. |

## Known limitations

See `README.md` and `docs/ARCHITECTURE.md`. The most important ones for evaluation are:

- Live rooms are in memory; run one API instance unless a Redis adapter is added.
- Mesh WebRTC is comfortable up to about eight cameras; larger classes need an SFU.
- No TURN is configured locally, so strict-network relay behaviour is unverified.
- CloudFront URLs are unguessable but unsigned.
- JWTs are stored in `localStorage` and have no server-side revocation list; disabling an account takes effect on the next request.
- Instructor payouts are not implemented; earnings are recorded and reported.
- No production deployment or public URL exists yet.

## Future improvements

1. CloudFront signed cookies for paid media.
2. HttpOnly secure session cookies with CSRF protection and a revocation list.
3. Socket.IO Redis adapter plus shared room state for multiple instances.
4. SFU such as LiveKit for larger classes.
5. Stripe Connect payouts.
6. CI workflow running tests, doctor and build on every commit.
7. Platform deployment manifests and verified public smoke test.

## Evidence

See `docs/EVIDENCE.md` for the curated screenshot index and `docs/TEST_RESULTS.md` for final results. Raw Phase A–G JSON reports remain in the temporary browser-audit directory, not in the repository.
