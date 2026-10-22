# Identity and vendor approval — frontend integration

Implemented on `codex/accounts-and-vendor-approval`; available after merge and database configuration. These are backend endpoints, not completed screens. Use same-origin `/api` requests. Never silently substitute mocks after failure.

## Account endpoints

All POST requests require `Content-Type: application/json` and an Origin matching APP_ORIGIN. Send only the listed fields. Responses are JSON; errors are `{error:{code,message}}`. No tokens or passwords go in localStorage. Browser stores the HttpOnly session cookie automatically; use credentials for fetch. Cross-origin frontend deployment is not supported by this contract.

| Method/path | Body | Success |
|---|---|---|
| POST /api/auth/signup | email, password, fullName | 202 generic message; email queued |
| POST /api/auth/login | email, password | 200 `{user}` and session cookie |
| GET /api/auth/me | — | 200 `{user}` |
| POST /api/auth/logout | {} | 200 message; cookie cleared |
| POST /api/auth/resend-verification | email | 202 generic message |
| POST /api/auth/forgot-password | email | 202 generic message |
| POST /api/auth/verify-email | token | 200 message |
| POST /api/auth/reset-password | token, password | 200 message; all sessions revoked |

User: `{id,email,fullName,verified,roles}`. Signup always creates a customer, never a browser-selected role. Password 12–128 characters, name 2–100 characters. Login works before verification, but protected vendor actions require verified email. Session lasts seven days. Verification links expire after 24 hours; reset after one hour. Links are single-use; resending invalidates the previous token.

Build `/verify-email` and `/reset-password` pages. Read `#token=...`, remove it from browser history, and POST it to the matching endpoint. Do not log it or send it to analytics. After success direct the user to login. Preserve an intended destination only if it is a validated local path. Account creation and email verification do not automatically sign the user in.

Show field errors (400), sign-in prompt (401), permission/verification states (403), conflicts (409), retry message (429; Retry-After seconds), and service error (503). Never claim delivery just because an email was queued. Duplicate signup and unknown recovery addresses return the same generic message.

## Vendor endpoints

| Method/path | Body | Success |
|---|---|---|
| GET /api/vendor/application | — | `{application:null}` or own application |
| POST /api/vendor/application | businessName, businessLocation, country, registrationNumber | 201 `{application:{id,status}}` |
| GET /api/vendor/access | — | `{allowed:true,userId}` for approved vendors |
| GET /api/admin/vendor-applications | — | `{applications:[...]}` latest 100; admin only |
| POST /api/admin/vendor-applications/:id/review | decision, note | `{application:{id,status}}`; admin only |

Application reads use database field names: `business_name,business_location,country,registration_number,status,review_note`. Country currently NG only; registrationNumber is required in this first backend contract, not independently verified against a registry. Confirm this onboarding requirement against approved screens before connecting the form. Admin list includes submitted application details for manual review; pagination and secure document uploads are future increments.

States: submitted → changes_requested → submitted; submitted → approved or rejected; approved → suspended. Resubmission allowed only from draft/changes_requested. Rejected/suspended reopening is not implemented. Vendor access is denied immediately on suspension, even for an existing session. Approval grants the vendor role atomically with an audit entry. Admin cannot review their own application. Every review requires a note. This is application approval, not product verification or order approval.

Frontend developer owns authentication and vendor-facing screens. Backend/admin work stays with our side. No catalogue, order persistence, payment or delivery endpoints are included yet.
