# Deployment limitations

## Current deployment status

No production deployment exists. The GitHub repository is public, but no Node host, database, Redis, object storage, Stripe credentials or public domain have been configured. Vercel CLI authentication exists, but a static-only frontend would not provide the API, Socket.IO, FFmpeg or upload handling; no partial deployment was created because it would be non-functional.

## Functional and architectural limits

| Limit | Impact | Mitigation / future work |
| --- | --- | --- |
| Live-class rooms are held in process memory | Only one API instance is safe; sticky sessions are insufficient | Add Socket.IO Redis adapter and shared room state |
| WebRTC full mesh | Comfortable up to about eight cameras; O(n²) bandwidth/CPU | Add an SFU such as LiveKit |
| No TURN configured locally | Strict corporate/mobile networks may join but see black video | Configure TURN URL/username/credential |
| Local media storage fallback | Files disappear on ephemeral redeploys | Use S3 + CloudFront; production startup now rejects local storage |
| Test payment fallback | Would grant paid access using test cards | Production startup now requires Stripe test key and webhook secret |
| Unsigned CloudFront URLs | Paid video URLs can be shared after enrollment | Add short-lived signed cookies after enrollment checks |
| JWT in `localStorage` | XSS would expose bearer tokens | Use HttpOnly cookies + CSRF or in-memory access tokens with refresh |
| No server-side token revocation | Logout/password change does not invalidate existing JWTs early | Add per-user token version and socket revalidation |
| Uploads buffered locally before worker | Source files can be lost on restart unless shared storage is used | Use S3 source handoff / separate worker or persistent volume |
| FFmpeg in API process | CPU/memory heavy; unsuitable for serverless | Use a separate worker service with Redis and S3 |
| 1 GiB default upload cap | Platform proxy limits may reject earlier | Set `MAX_UPLOAD_MB` and reverse-proxy body size intentionally |
| Health endpoint is shallow | `ok` reflects initial DB mode only, not live dependency health | Add deep readiness checks for DB, Redis, S3 |
| Shutdown is best-effort | In-flight HTTP/socket sessions are not fully drained | Add graceful drain/readiness handling |
| No migrations | Schema changes rely on Mongoose indexes/model definitions | Introduce versioned migrations for future schema changes |
| Demo password documented | Safe locally, unsafe if seeded into production | Keep `AUTO_SEED=false`; change demo passwords if copied |

## Verification gaps

The following remain unverified and must not be claimed as passing:

- public production URL smoke tests;
- managed MongoDB/Redis connectivity;
- S3/CloudFront media delivery and CORS;
- Stripe webhook delivery through a public endpoint;
- TURN relay candidates;
- physical camera/microphone quality;
- multi-instance Socket.IO behaviour.

## Security work completed for deployment

- Production startup now rejects embedded MongoDB, inline queue, local media storage, auto-seeding, missing JWT secret, missing/test-mode Stripe misconfiguration, missing webhook secret and localhost/non-HTTPS URLs.
- These guards are unit-tested.
- No secrets are committed; `.env` and `.vercel` are ignored.

## Remaining security recommendations

1. CloudFront signed cookies for paid media.
2. Session version/revocation list and socket revalidation.
3. Targeted rate limits on upload, checkout, quiz, certificate and socket-message paths.
4. Magic-byte validation and per-user upload quotas.
5. Secure admin onboarding without command-line passwords.
6. CI running tests, build and config validation on every push.
