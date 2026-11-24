# Evidence index

Curated screenshots from the Phase A–G browser QA are stored in `docs/screenshots/`. They contain only demo or temporary test data and no credentials or tokens.

| Requirement | Screenshot |
| --- | --- |
| Landing page | `screenshots/submission-landing.png` |
| Student dashboard / My Learning | `screenshots/submission-student-dashboard.png` |
| Course detail and purchase card | `screenshots/submission-course-detail.png` |
| Video lesson with quality controls | `screenshots/submission-video-lesson.png` |
| Quiz result with explanation | `screenshots/submission-quiz-result.png` |
| Passing quiz / course completion | `screenshots/submission-quiz-passed.png` |
| Certificate | `screenshots/submission-certificate.png` |
| Instructor dashboard and earnings | `screenshots/submission-instructor-dashboard.png` |
| Course editor / lesson management | `screenshots/submission-course-management.png` |
| Admin dashboard | `screenshots/submission-admin-dashboard.png` |
| Checkout / test gateway order | `screenshots/submission-checkout.png` |
| Successful test payment and unlock | `screenshots/submission-payment-success.png` |
| Two-participant live class | `screenshots/submission-live-class.png` |
| Remote media and peer connection state | `screenshots/submission-live-media.png` |

## Structured reports

Raw structured results are kept outside the repository in:

```text
%LOCALAPPDATA%\Temp\opencode\browser-audit\
```

Key files:

- `phase-a.json` — authentication and navigation
- `phase-b.json`, `phase-b-resume.json`, `phase-b-final.json` — student workflow
- `phase-c.json` — instructor workflow
- `phase-d.json` — admin workflow
- `phase-e.json` — payment workflow
- `phase-f.json` — live classes
- `phase-g.json`, `phase-g-report.md`, `phase-g-continuation.json` — media reliability
- `checkout-cancel-verification.json` — regression verification for commit `ea55b93`

Do not add Chrome profiles, browser logs, `.env` files or database files to the repository.
