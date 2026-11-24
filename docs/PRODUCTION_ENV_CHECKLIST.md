# Production environment checklist

Set these values on the hosting platform. Never commit `.env` files or paste secret values into chat. Placeholders beginning with `REPLACE_ME` are treated as unset by the application.

## Required for a safe production start

| Variable | Expected value | Purpose / guard |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables production guards and disables dev defaults. |
| `PORT` | platform-provided | HTTP port; do not hard-code on managed platforms. |
| `CLIENT_URL` | final HTTPS app URL | CORS, Socket.IO CORS, Stripe return URL, certificate links. Guarded against localhost/non-HTTPS. |
| `PUBLIC_URL` | same as `CLIENT_URL` for single host | API public origin. Guarded against localhost/non-HTTPS. |
| `JWT_SECRET` | long stable random value | Signs login tokens. Required in production. |
| `JWT_EXPIRES_IN` | e.g. `7d` | Token lifetime. |
| `MONGO_URI` | managed MongoDB URI with database name | Persistent database. Connection failure is fatal. |
| `MONGO_MEMORY_FALLBACK` | `false` | Embedded database forbidden in production. |
| `AUTO_SEED` | `false` | Demo data not loaded automatically. |
| `QUEUE_DRIVER` | `bullmq` | Durable jobs; `inline` is rejected in production. |
| `REDIS_URL` | managed Redis URL | BullMQ queue and worker. |
| `RUN_WORKER_IN_API` | `true` for one-service setup | FFmpeg worker in API process. |
| `TRANSCODE_CONCURRENCY` | `1` initially | Limits CPU use. |
| `STORAGE_DRIVER` | `s3` | Local disk rejected in production. |
| `AWS_REGION` | bucket region | S3 SDK. |
| `AWS_ACCESS_KEY_ID` | IAM key or instance role | S3 upload/delete. |
| `AWS_SECRET_ACCESS_KEY` | IAM secret or instance role | S3 upload/delete. |
| `S3_BUCKET` | private bucket name | HLS, posters, thumbnails. |
| `CLOUDFRONT_DOMAIN` | distribution domain only | Media delivery; no `https://`. |
| `STRIPE_SECRET_KEY` | `sk_test_...` only | Test-mode Checkout; live keys rejected. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Required to verify webhook signatures. |
| `PLATFORM_FEE_PERCENT` | `20` | Revenue split. |
| `CURRENCY` | `usd` | Payment currency. |

## Optional / operational

| Variable | Expected value | Purpose |
| --- | --- | --- |
| `FFMPEG_PATH` | empty or system path | Bundled `ffmpeg-static` is used if empty. |
| `FFMPEG_PRESET` | `veryfast` | Encoding speed/size trade-off. |
| `MAX_UPLOAD_MB` | e.g. `256` to `1024` | Upload cap; reverse proxy must allow larger bodies. |
| `STUN_URLS` | default Google STUN is acceptable | ICE server list. |
| `TURN_URL` | TURN URI | Strict-network relay; health reports `turn:true` when set. |
| `TURN_USERNAME` | TURN user | With TURN. |
| `TURN_CREDENTIAL` | TURN credential | With TURN. |
| `VITE_API_URL` | API origin, set only for Vercel split | Build-time client API base. Leave empty for single-host. |
| `VITE_DEV_API_TARGET` | local only | Development proxy target. |

## Verification

After configuring, on the host:

```bash
npm run doctor
curl https://<domain>/api/health
```

Expected production health values include `env:production`, `database:mongodb`, `queue:bullmq`, `storage:s3`, `payments:stripe`, `ffmpeg:true`. `turn:true` only if TURN is configured.

Do not reuse the generated local `JWT_SECRET` or any local credential in production.
