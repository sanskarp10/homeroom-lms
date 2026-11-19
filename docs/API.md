# API reference

Base URL: `/api`. JSON in, JSON out. Authenticated requests send `Authorization: Bearer <token>`.

Errors always have this shape, with the matching HTTP status (400 validation, 401 not signed in, 403 not allowed, 404 not found):

```json
{ "error": "A sentence a person can act on.", "details": [{ "field": "email", "message": "Enter a valid email address." }] }
```

Money is in minor units (cents). Dates are ISO 8601. Roles: `student`, `instructor`, `admin`.

## Health

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | none | Which drivers are active: database, queue, storage, payments, ffmpeg, turn |

## Auth

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | none | `name, email, password (8+), role: student or instructor` | `token, user` |
| POST | `/auth/login` | none | `email, password` | `token, user` |
| GET | `/auth/me` | any | | `user` |
| PATCH | `/auth/me` | any | `name?, headline?, bio?` | `user` |
| POST | `/auth/password` | any | `currentPassword, newPassword` | `ok` |

## Catalog

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/courses` | none | Published courses. Query: `q, category, level, price (free or paid), sort (popular, newest, price-asc, price-desc), page, limit` |
| GET | `/courses/categories` | none | Subjects with counts, and levels |
| GET | `/courses/:slug` | optional | Course, curriculum outline (no lesson content, no quiz answers), upcoming live classes, and `access { enrolled, manage, progress }` |

## Learning (students)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/learn/enrollments` | any | My courses with progress and certificate |
| POST | `/learn/enrollments` | any | `courseId`. Enroll in a free course |
| GET | `/learn/courses/:courseId` | enrolled, owner or admin | Curriculum with completion ticks, progress, certificate |
| GET | `/learn/lessons/:lessonId` | enrolled, owner, admin, or anyone if the lesson is a free preview | Lesson content, HLS URL, quiz without answers, saved position, last attempt |
| POST | `/learn/lessons/:lessonId/position` | enrolled | `position` in seconds. Saves the resume point; completes the lesson at 90% watched |
| POST | `/learn/lessons/:lessonId/complete` | enrolled | `completed: boolean`. Not allowed for quizzes |
| POST | `/learn/lessons/:lessonId/quiz` | enrolled | `answers: { questionId: [optionIndex] }`. Returns the graded attempt with correct answers and explanations; passing completes the lesson |

Progress responses include `progress` (0 to 100), `courseCompleted` and, when the course is finished, `certificate`.

## Course builder (instructors and admins)

All paths start with `/manage`. Instructors can only change their own courses.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/manage/courses` | My courses |
| POST | `/manage/courses` | Create a draft: `title, category?, level?, price?, subtitle?, description?, outcomes?` |
| GET | `/manage/courses/:id` | Full course for the editor, including quiz answers and video state |
| PATCH | `/manage/courses/:id` | Update details |
| POST | `/manage/courses/:id/thumbnail` | Multipart field `image` (JPG, PNG, WebP, 5 MB) |
| POST | `/manage/courses/:id/publish` | `published: boolean`. Publishing fails with a list of problems until there is a lesson, a description, every video is ready and every quiz has questions |
| DELETE | `/manage/courses/:id` | Only when nobody is enrolled |
| POST | `/manage/courses/:id/sections` | `title` |
| PATCH / DELETE | `/manage/courses/:id/sections/:sectionId` | Rename, or delete an empty section |
| PUT | `/manage/courses/:id/order` | `sections: [{ id, lessons: [lessonId] }]`. Saves the order of sections and lessons |
| POST | `/manage/courses/:id/lessons` | `sectionId, title, type: video, article or quiz` |
| GET | `/manage/lessons/:lessonId` | One lesson (used to poll conversion progress) |
| PATCH | `/manage/lessons/:lessonId` | `title?, isPreview?, content?, quiz? { passingPercent, questions: [{ prompt, type, options, correct, points, explanation }] }` |
| DELETE | `/manage/lessons/:lessonId` | Deletes the lesson and its video |
| POST | `/manage/lessons/:lessonId/video` | Multipart field `video`. Returns `202` at once; a BullMQ job transcodes to HLS. Poll the lesson: `video.status` goes `queued`, `processing` (with `progress`), then `ready` or `failed` |
| DELETE | `/manage/lessons/:lessonId/video` | Remove the video |

## Payments

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/payments/config` | none | `provider` (`stripe` or `test`), `currency`, `platformFeePercent` |
| POST | `/payments/checkout` | any | `courseId`. Returns `{ enrolled: true }` for free or already-owned courses, `{ url }` for Stripe Checkout, or `{ orderId }` for the test gateway |
| GET | `/payments/orders` | any | My paid orders |
| GET | `/payments/orders/:id` | owner | One order |
| POST | `/payments/test/:orderId/pay` | owner | Test gateway only: `name, cardNumber, expiry (MM/YY), cvc`. `4242 4242 4242 4242` succeeds; `4000 0000 0000 0002` is declined (402) |
| GET | `/payments/stripe/verify?session_id=` | owner | Confirms a Stripe session after the redirect and enrolls the buyer |
| POST | `/payments/webhook` | Stripe signature | `checkout.session.completed`: marks the order paid and enrolls the buyer (idempotent) |

Each order stores `amount`, `platformFee` and `instructorNet`.

## Instructor dashboard

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/instructor/dashboard?days=7,30,90 or 365` | instructor, admin | `range`, `previous` and `lifetime` totals (`gross, net, fees, sales`), `students`, a zero-filled daily `series`, per-course `courses` (students, completions, average progress, earnings) and `recent` sales |

## Live classes

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/live/schedule` | optional | Public timetable of live and upcoming classes, with `canJoin` for the viewer |
| GET | `/live/mine` | any | Upcoming and past classes of the courses I study or teach |
| GET | `/live/course/:courseId` | owner, admin | All classes of a course |
| POST | `/live` | owner, admin | `courseId, title, description?, scheduledAt, durationMin` |
| PATCH / DELETE | `/live/:id` | owner, admin | Edit or remove a class |
| POST | `/live/:id/start` | owner, admin | Opens the room |
| POST | `/live/:id/end` | owner, admin | Ends the class and disconnects everyone |
| GET | `/live/:id` | enrolled, owner, admin | Class details, `isHost`, `iceServers`, people online, chat history |

### Socket.IO events

Connect to the API origin with `auth: { token }`. All live events are scoped to the room joined with `live:join`.

| Direction | Event | Payload | Meaning |
| --- | --- | --- | --- |
| client to server | `live:join` | `{ classId, media: { audio, video } }`, ack `{ ok, self, peers }` or `{ error, waiting? }` | Join. Students are refused with `waiting: true` until the host starts the class |
| both | `live:signal` | send `{ to, data }`, receive `{ from, data }` where data is `{ description }` or `{ candidate }` | WebRTC offer, answer and ICE relay |
| client to server | `live:state` | `{ media: { audio, video, screen }, hand }` | My microphone, camera, screen share and raised hand |
| client to server | `live:chat` | `{ text }` | Send a chat message (saved) |
| client to server | `live:mute-all`, `live:lower-hand { socketId }` | | Host controls |
| client to server | `live:leave` | | Leave the room |
| server to client | `live:peer-joined`, `live:peer-left`, `live:peer-state` | participant info | Presence |
| server to client | `live:chat` | `{ id, userId, name, role, text, at }` | A chat message |
| server to client | `live:force-mute`, `live:ended` | | The host muted everyone, or ended the class |

## Certificates

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/certificates` | any | My certificates |
| GET | `/certificates/verify/:code` | none | Public check that a certificate ID is genuine |
| GET | `/certificates/:code/pdf` | none (the ID is the credential) | The PDF, generated on request. `?download=1` forces a download |

## Admin

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/overview` | Totals for sales, fees, people, courses, enrollments, certificates, live classes, video pipeline and queue |
| GET | `/admin/users?q=&role=&page=` | People |
| PATCH | `/admin/users/:id` | `role?, disabled?` |
| GET | `/admin/courses?status=&q=` | All courses |
| PATCH | `/admin/courses/:id` | `status: draft, published or archived` |

## Media

With local storage, HLS playlists, segments, posters and course images are served from `/media/...`.
With S3 + CloudFront the API returns absolute `https://<CLOUDFRONT_DOMAIN>/...` URLs instead.

```
videos/<assetId>/master.m3u8
videos/<assetId>/v360/index.m3u8, seg_0000.ts ...
videos/<assetId>/v720/...
videos/<assetId>/poster.jpg
thumbnails/<courseId>-<random>.jpg
```
