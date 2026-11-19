# 10-minute presentation outline

A talk track for the final presentation. Times are a guide.

| Time | Section | Show | Say |
| --- | --- | --- | --- |
| 0:00 | Problem | Home page | An online school needs four things that usually come from four products: a catalog with checkout, streaming video, a live classroom, and proof of completion. Homeroom does all four in one MERN app. |
| 1:00 | Demo: student | Buy a course with the test card, play a video, switch quality, fail then pass a quiz, download the certificate, verify it | Point out resume, auto-complete at 90%, instant marking with explanations. |
| 3:30 | Demo: instructor | Upload a video and watch Uploading, Converting, Ready. Add a quiz. Open the earnings dashboard | The upload returns in under 100 ms; FFmpeg runs in a BullMQ job; the split is stored per order. |
| 5:30 | Demo: live class | Two browsers: start, join from the waiting room, share screen, chat, raise hand, end | Media is peer to peer; the server only relays signalling. |
| 6:30 | Design | `docs/ARCHITECTURE.md` diagrams | Drivers with local fallbacks; lesson document as the source of truth for video state; who-offers rule for WebRTC; keys not URLs. |
| 8:00 | Challenges | | Pick two or three you can speak to: HLS without upscaling and with or without audio; avoiding offer collisions in a mesh; idempotent fulfilment between redirect and webhook; making the project run with zero accounts. |
| 9:00 | Results | `docs/TEST_RESULTS.md` | 45 API tests, 11 browser journeys including real WebRTC, latency and transcode numbers. |
| 9:30 | Next steps | | SFU (LiveKit) for large classes, CloudFront signed cookies, Stripe Connect payouts, Redis adapter for multiple instances, reviews and ratings. |

The individual reflection is yours to write: what you built with your own hands, what you learned, and what you
would do differently.
