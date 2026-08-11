# Profile-photo Playwright coverage

`profile-photo-flow.spec.ts` is the fast browser contract suite. It mocks the
Next.js BFF responses so UI states are deterministic, but uses genuinely valid
600 x 750 PNG upload and replacement files.

`profile-photo.live.spec.ts` is a separate opt-in destructive integration suite.
It does not register any Playwright routes or mock Django. Upload, image reads,
moderation, access checks, replacement, primary selection, and deletion all go
through `/api/proxy/` to the configured Django/PostgreSQL stack. It creates one
photo and deletes that exact id in `finally`; it never deletes pre-existing
photos. Use dedicated test accounts and a disposable or staging database.

Required conditions:

- The owner and viewer are distinct active, approved members who have not
  blocked one another.
- The owner has fewer than six photos.
- The administrative account is a super admin, or an admin with
  `verification.approve`, `verification.reject`, `verification.view_all`, and
  branch scope over the owner.
- Next.js points to the intended Django/PostgreSQL test stack.

Required environment variables:

```text
PROFILE_PHOTO_LIVE_E2E=1
PLAYWRIGHT_BASE_URL=https://staging.example.test
PROFILE_PHOTO_E2E_MEMBER_IDENTIFIER=owner@example.test
PROFILE_PHOTO_E2E_MEMBER_PASSWORD=...
PROFILE_PHOTO_E2E_VIEWER_IDENTIFIER=viewer@example.test
PROFILE_PHOTO_E2E_VIEWER_PASSWORD=...
PROFILE_PHOTO_E2E_ADMIN_EMAIL=admin@example.test
PROFILE_PHOTO_E2E_ADMIN_PASSWORD=...
```

Optional variables:

```text
PROFILE_PHOTO_E2E_ADMIN_ACCOUNT_TYPE=SUPER_ADMIN
PROFILE_PHOTO_E2E_ADMIN_OTP=123456
```

Run only the live scenario with `npm run test:e2e:live:profile-photo`. Without
`PROFILE_PHOTO_LIVE_E2E=1`, the normal Playwright run excludes `*.live.spec.ts`.
