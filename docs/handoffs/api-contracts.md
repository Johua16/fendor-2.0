# API contracts and integration status

Foundation endpoints:

| Method | Path | Result |
| --- | --- | --- |
| GET | /api/health | 200: { service: "fendor", status: "running", stage: "foundation" } |
| GET | /api/ready | 200 after identity configuration/migrations; otherwise 503 |

Identity and vendor approval endpoints are implemented in the accounts feature branch; see [identity contract](identity-api.md) and [setup](../identity-setup.md). Product, order and payment APIs are not implemented. The legacy backend is not the new API contract. Health does not imply readiness.

Before each feature, jointly specify method/path, input/output types, validation errors, authentication/session handling, role and ownership checks, state transitions, pagination and retry/idempotency behaviour. Record accepted contracts here; mark drafts as proposals.

Frontend can develop against matching explicit mocks before integration. Mock state is not production authentication, stock or payment verification. Never fall back to simulated success after a real request fails.

Use integer kobo for NGN and integer quantities. Browser values are untrusted; server recomputes totals and checks inventory. Domain state names are in server/src/order.ts. Its actor argument represents authenticated identity loaded by future server code, not an accepted client payload.

Next backend increments: database/migrations, persistent identity and sessions, then vendor/catalogue APIs. Inventory concurrency, payment evidence, idempotency and atomic audit events remain implementation requirements, not features completed by the pure domain transition function.
