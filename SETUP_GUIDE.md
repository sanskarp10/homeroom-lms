# Homeroom setup guide

This guide is written for an AI agent or a person who has never seen this project.
Follow it top to bottom. Do not skip steps. Do not improvise.

## Rules for whoever is following this guide

1. Run every command from the **project root** (the folder that contains this file), unless a step says otherwise.
2. After every step in Part B, run `npm run doctor`. It prints one line per service:
   - `PASS` = working.
   - `WARN` = running on a local fallback. Fine for development. Must be fixed before going live if the step says so.
   - `FAIL` = broken. Stop and fix it before moving on.
3. All secrets go in **`server/.env`**. Never put secrets in any other file. Never commit `server/.env` (it is already in `.gitignore`).
4. A value that still starts with `REPLACE_ME` means "not configured". The app treats it as empty and uses a fallback. To configure something, replace the **whole value** after the `=` sign.
5. Do not edit source code to configure the app. Everything is configured through `server/.env` (and, only for split hosting, `client/.env`).
6. If a command fails, read the error, then check the **Troubleshooting** section at the bottom before trying anything else.

---

# Part A. Run it on your own machine (about 5 minutes)

You need **Node.js 20 or newer** and nothing else. Check with:

```bash
node -v
```

If the version is lower than 20, install Node 20+ from https://nodejs.org and reopen the terminal.

### A1. Install

```bash
npm install
```

Expected: finishes without `npm error`. It installs the server and the client together (npm workspaces) and downloads a bundled FFmpeg binary.

### A2. Start

```bash
npm run dev
```

What happens automatically, the first time:

| What | Detail |
| --- | --- |
| `server/.env` is created | Copied from `server/.env.example`, with a random `JWT_SECRET`. |
| A database starts | If no MongoDB answers on `localhost:27017`, an embedded MongoDB is downloaded once (about 100 MB) and started. Its data is kept in `server/.data`. |
| The job queue starts | If no Redis answers on `localhost:6379`, video jobs run inside the API process instead of BullMQ. |
| Demo content loads | 12 courses, 52 lessons, three sample videos transcoded with FFmpeg, 42 accounts, sales history, live classes. Takes 30 to 90 seconds. |

Wait until the terminal prints a line like:

```
Homeroom API on http://localhost:4000  [db: ... | queue: ... | storage: local | payments: test]
```

### A3. Open the app

Open **http://localhost:5173** in Chrome, Edge, Firefox or Safari.

Demo accounts (the sign-in page has one-click buttons for them). Password for all: `homeroom123`

| Role | Email | What to look at |
| --- | --- | --- |
| Student | `sam@homeroom.test` | My learning, the video player, quizzes, certificates |
| Instructor | `maya@homeroom.test` | Teach: earnings dashboard, course editor, video upload, live classes |
| Admin | `admin@homeroom.test` | Admin: totals, people, courses, video pipeline |

### A4. Optional: use real MongoDB and Redis locally (enables BullMQ)

If Docker is installed:

```bash
docker compose up -d
```

Then stop `npm run dev` (Ctrl+C) and start it again. `npm run doctor` should now show `PASS mongodb` and `PASS redis`.
Because this is a new, empty database, the demo content loads again on first start.

### A5. Check that it works

```bash
npm run doctor     # no FAIL lines
npm test           # 45 tests pass (uses its own throwaway database)
```

Manual check, 2 minutes:

1. Sign in as the student. Open "React from first principles" and press **Continue learning**. A video plays.
2. Open any paid course, press **Buy this course**, press **Fill in the test card**, press **Pay**. You land in the course.
3. Sign in as the instructor in a second browser (or a private window). Open **Live classes**, open "Office hours: your hooks questions", press **Start the class**. In the student browser open the same class and press **Join the class**. Both sides see and hear each other.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | API on port 4000 and the web app on port 5173, both with auto-reload |
| `npm run seed:reset` | Wipes the database and reloads the demo content (also refreshes the live class timetable) |
| `npm run build` then `npm start` | Production mode: one server on port 4000 serves both the API and the built web app |
| `npm run doctor` | Checks every external service |
| `npm test` | Runs the API test suite |
| `npm run worker` | Runs the video worker as its own process (only with `RUN_WORKER_IN_API=false`) |
| `npm run create-admin -- email password "Name"` | Creates or promotes an admin account |

**Part A is complete when** the app opens, the three demo accounts sign in, and `npm run doctor` prints no `FAIL` line.

---

# Part B. Make it fully live

Local mode uses four fallbacks. Each step below replaces one fallback with the real service.
Do the steps in order. After each one run `npm run doctor`.

| Fallback in local mode | Real service | Step |
| --- | --- | --- |
| Embedded MongoDB | MongoDB Atlas | B2 |
| In-process job queue | Redis + BullMQ | B3 |
| Files on local disk | AWS S3 + CloudFront | B5 |
| Built-in test card form | Stripe Checkout (test mode) | B6 |
| STUN only | STUN + TURN | B7 |

## B1. Decide the public address

Recommended shape: **one host** runs `npm start`, which serves the API and the web app together on one HTTPS domain.

Write down the final public URL, for example `https://homeroom.example.com`. You need it in several steps. In this guide it is called **APP_URL**.

HTTPS is required. Browsers refuse camera and microphone access on plain `http://` (except on localhost), so live classes do not work without HTTPS.

## B2. MongoDB Atlas (database)

1. Go to https://www.mongodb.com/atlas and create a free account and a free **M0** cluster.
2. **Database Access** > Add New Database User. Choose a username and a password. Save both. Role: "Read and write to any database".
3. **Network Access** > Add IP Address. For a first deploy choose "Allow access from anywhere" (`0.0.0.0/0`). Tighten this later to your host's IP.
4. **Database** > Connect > Drivers. Copy the connection string. It looks like:
   `mongodb+srv://USER:PASSWORD@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
5. Insert the database name `homeroom` before the `?`, and put the real password in. If the password contains `@ : / ? #` characters, URL-encode them.

Edit `server/.env`:

```
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster0.abcde.mongodb.net/homeroom?retryWrites=true&w=majority
MONGO_MEMORY_FALLBACK=false
```

Verify: `npm run doctor` shows `PASS  mongodb`.

## B3. Redis (BullMQ video queue)

Any Redis 6+ works. Easiest free option: https://upstash.com (create a Redis database, choose a region near your host).
Other options: Redis Cloud, Render Key Value, Railway Redis, or your own server.

Copy the connection URL. With TLS it starts with `rediss://` (two s). Example:
`rediss://default:PASSWORD@eu1-fine-fox-12345.upstash.io:6379`

Edit `server/.env`:

```
REDIS_URL=rediss://default:PASSWORD@your-redis-host:6379
QUEUE_DRIVER=bullmq
```

Verify: `npm run doctor` shows `PASS  redis ... (BullMQ queue active)`.

Note for Upstash free tier: BullMQ polls Redis continuously, which uses commands from the daily quota. If the quota runs out, use Redis Cloud or a small self-hosted Redis instead.

## B4. FFmpeg

Nothing to do in most cases. `npm install` downloads a bundled FFmpeg (the `ffmpeg-static` package) and the app uses it automatically.

Only if `npm run doctor` shows `FAIL  ffmpeg`:

1. Install FFmpeg on the host (`sudo apt-get install -y ffmpeg`, `brew install ffmpeg`, or use the included `Dockerfile`, which installs it).
2. Find its path with `which ffmpeg` (Windows: `where ffmpeg`).
3. Edit `server/.env`: `FFMPEG_PATH=/usr/bin/ffmpeg` (use the path from step 2).

## B5. AWS S3 + CloudFront (video storage and delivery)

Goal: transcoded video (HLS playlists and segments), posters and course images are stored in a private S3 bucket and delivered only through CloudFront.

You need an AWS account. Do these in the AWS console, in this order.

### B5.1 Create the bucket

1. S3 > **Create bucket**.
2. Bucket name: something unique, for example `homeroom-media-yourname`. Write it down as **BUCKET**.
3. Region: pick one near your users, for example `us-east-1`. Write it down as **REGION**.
4. Leave **Block all public access** switched ON. Create the bucket.

### B5.2 Create the CloudFront distribution

1. CloudFront > **Create distribution**.
2. Origin domain: choose the bucket from the list.
3. Origin access: choose **Origin access control settings (recommended)** and create a new OAC with the defaults.
4. Viewer protocol policy: **Redirect HTTP to HTTPS**.
5. Allowed HTTP methods: **GET, HEAD, OPTIONS**.
6. Cache policy: **CachingOptimized**.
7. Response headers policy: **SimpleCORS** (a managed policy). This is required: the video player fetches playlists from another domain and the browser blocks them without this header.
8. Create the distribution. Copy:
   - the **Distribution domain name**, for example `d1234abcd.cloudfront.net`. Write it down as **CF_DOMAIN** (no `https://`).
   - the **distribution ARN**, for example `arn:aws:cloudfront::123456789012:distribution/E1ABCDEF`.

### B5.3 Let CloudFront read the bucket

CloudFront shows a banner "The S3 bucket policy needs to be updated" with a **Copy policy** button. Copy it, then go to S3 > BUCKET > Permissions > Bucket policy > Edit, paste, save.

If the banner is gone, use this policy and replace the three UPPERCASE values:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::BUCKET/*",
      "Condition": {
        "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID" }
      }
    }
  ]
}
```

### B5.4 Create credentials for the server

1. IAM > Users > **Create user**. Name: `homeroom-uploader`. No console access.
2. Permissions > Attach policies directly > **Create policy** > JSON. Paste this and replace BUCKET (two places):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::BUCKET/*" },
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::BUCKET" }
  ]
}
```

3. Attach that policy to the user.
4. Open the user > Security credentials > **Create access key** > "Application running outside AWS". Copy the **Access key ID** and the **Secret access key**. The secret is shown only once.

### B5.5 Configure the app

Edit `server/.env`:

```
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA................
AWS_SECRET_ACCESS_KEY=........................................
S3_BUCKET=homeroom-media-yourname
CLOUDFRONT_DOMAIN=d1234abcd.cloudfront.net
```

Verify: `npm run doctor` shows both `PASS  s3` and `PASS  cloudfront`.
The doctor writes a small test object, fetches it through CloudFront, then deletes it.
A new distribution needs up to 10 minutes to deploy. If `cloudfront` fails with HTTP 403 right after creating it, wait and run the doctor again.

Then load the demo videos into S3 (only needed if you want the demo catalog in production):

```bash
npm run seed:reset
```

Videos that were uploaded while the app used local storage are **not** copied to S3. Upload them again from the course editor.

## B6. Stripe (payments in test mode)

1. Create an account at https://dashboard.stripe.com. Make sure the **Test mode** switch is ON (the brief asks for test mode; no business verification is needed).
2. Developers > API keys. Copy the **Secret key**. It starts with `sk_test_`.
3. Developers > Webhooks > **Add endpoint**.
   - Endpoint URL: `APP_URL/api/payments/webhook` (for example `https://homeroom.example.com/api/payments/webhook`).
   - Events: select `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
   - Save, then open the endpoint and reveal the **Signing secret**. It starts with `whsec_`.

Edit `server/.env`:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PLATFORM_FEE_PERCENT=20
CURRENCY=usd
```

Verify: `npm run doctor` shows `PASS  stripe  key accepted (test mode)`.

How it behaves once the key is set:

- "Buy this course" sends the buyer to Stripe's hosted checkout page. Pay with `4242 4242 4242 4242`, any future date, any CVC.
- After payment Stripe sends the buyer back to `CLIENT_URL/checkout/success`. The server confirms the payment with Stripe and enrolls the student. The webhook does the same in the background, so enrollment still happens if the buyer closes the tab.
- The built-in test card form is switched off automatically.

To test webhooks on your own machine, install the Stripe CLI and run
`stripe listen --forward-to localhost:4000/api/payments/webhook`, then put the `whsec_` value it prints into `server/.env`.

Instructor earnings: every sale is split by `PLATFORM_FEE_PERCENT` and recorded per order. The dashboard reports what each instructor has earned. Sending money out to instructors' bank accounts (Stripe Connect payouts) is not part of this project.

## B7. TURN server (live classes on strict networks)

Live classes send video directly between browsers (WebRTC). A STUN server (already configured, free) is enough on most home networks. On company networks, some universities and some mobile carriers a **TURN** relay is required, otherwise people join but see black tiles.

Pick one:

- **Metered** (https://www.metered.ca, has a free tier): create an app, copy the TURN URL, username and credential it shows.
- **Twilio Network Traversal** or **Cloudflare Realtime TURN**: same three values.
- **Self-hosted coturn** on a small VPS: `turn:your-server-ip:3478` with a static user.

Edit `server/.env` (several URLs can be separated with commas):

```
TURN_URL=turn:your-turn-host:3478,turns:your-turn-host:5349
TURN_USERNAME=your-username
TURN_CREDENTIAL=your-credential
```

Verify: `npm run doctor` shows `PASS  turn`.

Capacity note: classes use a peer-to-peer mesh. It is comfortable up to about 8 people with cameras on. For larger classes see "Scaling live classes" in `docs/ARCHITECTURE.md`.

## B8. Production settings

Edit `server/.env`. Replace `APP_URL` with the real address from step B1 (no trailing slash):

```
NODE_ENV=production
CLIENT_URL=APP_URL
PUBLIC_URL=APP_URL
AUTO_SEED=false
MONGO_MEMORY_FALLBACK=false
```

`JWT_SECRET` must be a long random string. `npm run setup` already generated one. On a hosting platform, generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## B9. Deploy

Choose **one** option.

### Option 1: a platform that runs Node (Render, Railway, Fly.io, Heroku-style)

| Setting | Value |
| --- | --- |
| Root directory | the project root |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Node version | 20 or newer |
| Health check path | `/api/health` |
| Instances | **1** (live class rooms are held in memory) |

Add every variable from `server/.env` in the platform's "Environment variables" screen (the `.env` file itself is not uploaded). The platform sets `PORT` on its own; do not hard-code it there.

WebSockets must be allowed (they are by default on Render, Railway and Fly.io).

### Option 2: Docker on your own server

```bash
docker build -t homeroom .
docker run -d --name homeroom --restart unless-stopped -p 4000:4000 --env-file server/.env -e NODE_ENV=production homeroom
```

Put an HTTPS reverse proxy in front of port 4000. With Caddy the whole config is:

```
homeroom.example.com {
    reverse_proxy localhost:4000
}
```

Caddy obtains the certificate automatically and proxies WebSockets without extra settings. With nginx, add the `Upgrade` and `Connection` headers for `/socket.io/` and set `client_max_body_size 1100m;` so video uploads are not rejected.

### Option 3: frontend and API on different domains (for example Vercel + Render)

Only use this if you must. Then:

1. Deploy the API with Option 1. Its address is **API_URL**.
2. In `client/.env` set `VITE_API_URL=API_URL`, run `npm run build`, and deploy the folder `client/dist` as a static site. Configure the static host to serve `index.html` for unknown paths (single-page app fallback).
3. In the API's environment set `CLIENT_URL` to the frontend address and `PUBLIC_URL` to API_URL.
4. In Stripe, the webhook URL uses API_URL.

### Separate video worker (optional)

By default the API process also transcodes video. To move that work to its own machine: set `RUN_WORKER_IN_API=false` on the API, and run a second service with the **same environment variables** and the start command `npm run worker`. This requires Redis (B3) and S3 (B5).

## B10. First admin account

Production starts with an empty database (`AUTO_SEED=false`). Create your admin, from a shell that has the production environment variables:

```bash
npm run create-admin -- you@example.com "a-strong-password" "Your Name"
```

Everyone else registers through the site as a student or an instructor. Admins change roles under Admin > People.

If you want the demo catalog in production, run `npm run seed:reset` once instead. Change the demo passwords afterwards, because they are public.

## B11. Final check

1. `npm run doctor` on the server: every line is `PASS`.
2. Open `APP_URL/api/health`. Expected values:

```json
{ "ok": true, "env": "production", "database": "mongodb", "queue": "bullmq", "storage": "s3", "payments": "stripe", "ffmpeg": true, "turn": true }
```

3. In the browser, on APP_URL:
   - Register an instructor. Create a course, add a video lesson, upload an MP4. The status goes Uploading > Converting > Ready to stream, and the preview plays. In the browser's network tab the `.m3u8` and `.ts` requests go to the CloudFront domain.
   - Add a quiz question and a description, then publish.
   - Register a student in a private window. Buy the course with card `4242 4242 4242 4242`. The course opens.
   - Finish every lesson and pass the quiz. The certificate PDF downloads, and `APP_URL/verify/<ID>` confirms it.
   - Instructor: Live classes tab > schedule a class > Open classroom > Start the class. Student: join. Video, audio, screen share and chat work.
   - The instructor's Teach page shows the sale and the earnings.

**The project is fully live when all of step B11 passes.**

---

# Environment variable reference

All of these live in `server/.env`. "Fallback" is what happens when the value is empty or still a `REPLACE_ME` placeholder.

| Variable | Required to go live | Fallback | Meaning |
| --- | --- | --- | --- |
| `NODE_ENV` | yes, `production` | `development` | Production turns off the dev fallbacks and demo auto-load |
| `PORT` | no | `4000` | Port the API listens on |
| `CLIENT_URL` | yes | `http://localhost:5173` | Address users type. Used for CORS, Stripe return URLs and certificate links |
| `PUBLIC_URL` | yes | `http://localhost:4000` | Address of the API. Same as `CLIENT_URL` on a single host |
| `JWT_SECRET` | yes | dev-only secret (refused in production) | Signs login tokens |
| `JWT_EXPIRES_IN` | no | `7d` | Login lifetime |
| `MONGO_URI` | yes | `mongodb://127.0.0.1:27017/homeroom` | MongoDB connection string |
| `MONGO_MEMORY_FALLBACK` | set `false` | `true` in development | Start an embedded MongoDB when `MONGO_URI` is unreachable |
| `AUTO_SEED` | set `false` | `true` in development | Load demo content into an empty database |
| `REDIS_URL` | yes | `redis://127.0.0.1:6379` | Redis for BullMQ |
| `QUEUE_DRIVER` | `bullmq` | `auto` | `auto`, `bullmq` or `inline` |
| `RUN_WORKER_IN_API` | no | `true` | `false` when `npm run worker` runs separately |
| `TRANSCODE_CONCURRENCY` | no | `1` | Videos converted at the same time |
| `FFMPEG_PATH` | no | bundled binary, then `ffmpeg` on PATH | Path to FFmpeg |
| `FFMPEG_PRESET` | no | `veryfast` | x264 speed/size trade-off |
| `MAX_UPLOAD_MB` | no | `1024` | Largest video upload |
| `STORAGE_DRIVER` | `s3` | `auto` (s3 when the four AWS values are real, else local) | Where media is stored |
| `AWS_REGION` | yes | none | Region of the bucket |
| `AWS_ACCESS_KEY_ID` | yes (or use an instance role) | AWS default credential chain | IAM key |
| `AWS_SECRET_ACCESS_KEY` | yes (or use an instance role) | AWS default credential chain | IAM secret |
| `S3_BUCKET` | yes | none | Bucket name |
| `CLOUDFRONT_DOMAIN` | yes | none | Distribution domain, without `https://` |
| `STRIPE_SECRET_KEY` | yes | built-in test gateway | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | recommended | webhook signatures not checked | `whsec_...` |
| `PLATFORM_FEE_PERCENT` | no | `20` | Share of each sale kept by the platform |
| `CURRENCY` | no | `usd` | Three-letter currency code |
| `STUN_URLS` | no | Google public STUN | Comma-separated STUN URLs |
| `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` | recommended | no TURN | Relay for strict networks |

`client/.env` (only for split hosting):

| Variable | Meaning |
| --- | --- |
| `VITE_API_URL` | Public address of the API when the frontend is on another domain. Empty otherwise. Must be set **before** `npm run build`. |
| `VITE_DEV_API_TARGET` | Where `npm run dev` proxies API calls. Default `http://localhost:4000`. |

---

# Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `npm install` fails on `ffmpeg-static` | The binary download was blocked | Install FFmpeg yourself and set `FFMPEG_PATH` (step B4). Then `npm install --ignore-scripts`. |
| First `npm run dev` hangs at "Starting the embedded dev database" | The one-time MongoDB download is slow or blocked | Wait, or start MongoDB yourself: `docker compose up -d` (step A4), or set `MONGO_URI` to an Atlas cluster (step B2). |
| `EADDRINUSE: address already in use :::4000` | Another program uses port 4000 | Set `PORT=4100` in `server/.env` and `VITE_DEV_API_TARGET=http://localhost:4100` in `client/.env`. |
| The web page says the course list could not be loaded | The API is not running | Look at the terminal for the API error. Run `npm run doctor`. |
| Sign-in page demo buttons say "Email or password is incorrect" | Demo content is not loaded | `npm run seed:reset` |
| Live class timetable is empty or all in the past | Demo classes are scheduled relative to the day the data was loaded | `npm run seed:reset` |
| Video stays on "Waiting in the queue" | `RUN_WORKER_IN_API=false` but no worker is running | Start `npm run worker`, or set `RUN_WORKER_IN_API=true`. |
| Video ends in "could not be converted" | The file is not a readable video, or FFmpeg is missing | Try an MP4 (H.264). Check `npm run doctor` for `ffmpeg`. The exact FFmpeg message is shown in the editor. |
| "Processing was interrupted by a restart" | The API restarted while converting on the in-process queue | Upload the video again. With Redis and BullMQ (step B3) jobs survive restarts. |
| Video plays locally but not in production; console shows a CORS error on `.m3u8` | CloudFront does not send CORS headers | Step B5.2 point 7: attach the **SimpleCORS** response headers policy. |
| CloudFront returns 403 | Bucket policy missing, or the distribution is still deploying | Step B5.3. Wait 10 minutes after creating the distribution. |
| `FAIL s3 ... AccessDenied` | The IAM policy is missing or names another bucket | Step B5.4. Check that BUCKET is spelled the same in both places. |
| Camera does not turn on in a live class | The page is not on HTTPS, or permission was denied | Use HTTPS (step B1). Click the camera icon in the address bar and allow access. |
| People join a live class but see black tiles | Their network blocks direct connections | Add a TURN server (step B7). |
| After Stripe payment the course is not unlocked | `CLIENT_URL` is wrong, so the return page is on another address | Set `CLIENT_URL` to the real address. Add the webhook (step B6). |
| Upload fails behind nginx with "413" | nginx limits the request size | `client_max_body_size 1100m;` |
| Users are signed out after a deploy | `JWT_SECRET` changed | Keep the same `JWT_SECRET` across deploys. |
| Uploaded videos disappear after a redeploy | Storage is local disk on a host with a temporary filesystem | Use S3 + CloudFront (step B5). |
