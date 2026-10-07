# omnistore

Omnichannel microservices demo: three **NestJS** services exchanging events over **RabbitMQ**
(topic exchanges, dead-lettering, retries, idempotency), a **Strapi** headless-CMS product
catalog, a **SonarCloud** quality gate and **Postman/Newman** API tests in CI, deployed to
**Cloud Run** via Terraform and keyless (Workload Identity Federation) GitHub Actions.

This repo exists to demonstrate the backend half of the DXC full-stack role — NestJS, RabbitMQ,
Strapi, SonarQube/SonarCloud and Postman — that the rest of the portfolio does not cover.

## Architecture

```
orders ── order.created ──▶ payments ── payment.succeeded ──▶ notifications
   │                          │
   │ reads catalog            │ dead-letters after N retries
   ▼                          ▼
 strapi (/api/products)     payments.dlq.queue
```

| Service | Role | Port | Deploys as |
|---|---|---|---|
| `orders` | REST API (`POST /orders`), validates SKU against Strapi, emits `order.created` | 8080 (host 8083) | Cloud Run (public) |
| `payments` | consumes `order.created`, mocks payment, emits `payment.succeeded`; retries then dead-letters | 8081 | Cloud Run (min-instances=1) |
| `notifications` | consumes `payment.succeeded`, mocks dispatch | 8082 | Cloud Run (min-instances=1) |
| `strapi` | headless CMS, `product` content type, seeded on bootstrap | 1337 | Cloud Run (public) |

### RabbitMQ topology

- Exchanges (topic): `orders`, `payments`, `payments.dlq`.
- Queues: `payments` (bound to `orders` on `order.created`, with a dead-letter exchange),
  `notifications` (bound to `payments` on `payment.succeeded`), `payments.dlq.queue`.
- The `orders`/`payments` exchanges and their queues are asserted by Nest's RMQ transport
  (wildcards mode). The DLQ is asserted explicitly in
  [`payments/src/rabbitmq/topology.ts`](services/payments/src/rabbitmq/topology.ts).

### Delivery guarantees

- **Idempotency** — `payments` keeps an in-memory `Set<orderId>` so a redelivered message is
  acknowledged and dropped, not double-paid. (Demo-grade; production would use a datastore.)
- **Retry** — on a transient failure the consumer republishes `order.created` with an
  incremented `x-retries` header; after `MAX_RETRIES` the message is `nack`ed and dead-lettered
  to `payments.dlq.queue`.
- **Deterministic failure sentinel** — a product whose `sku` is `FAIL` always declines, which
  drives the retry → DLQ path end to end.

## Stack

- **NestJS 12** (TypeScript 6, ESM) on Node 24, `@nestjs/microservices` RMQ transport
  (`ClientProxy` producers + `@EventPattern`/`RmqContext` consumers).
- **RabbitMQ 3** (`amqplib`, `amqp-connection-manager`).
- **Strapi 5** headless CMS (SQLite locally; seeded `product` content type).
- **Vitest** unit tests, **oxlint**, **SonarCloud** quality gate, **Postman/Newman** API tests.
- **Docker**, **Terraform**, **Cloud Run**, **Artifact Registry**, **Workload Identity Federation**.

## Local development

Prerequisites: Node 24, Docker.

```bash
# 1. Start everything (RabbitMQ, Strapi, orders, payments, notifications)
docker compose up --build

# 2. Exercise the flow
curl -s localhost:8083/health
curl -s -X POST localhost:8083/orders -H 'content-type: application/json' \
  -d '{"sku":"SKU-100","qty":2}'
```

The seeded catalog is `SKU-100`, `SKU-101`, `SKU-102`. A `POST /orders` with a known SKU
returns `201` with `status: PENDING`; the `payments` and `notifications` logs then show the
event chain (`payment.succeeded` → notification). An unknown SKU returns `404`. Use
`"sku":"FAIL"` to watch the retry/DLQ path in the `payments` logs.

RabbitMQ management UI is at http://localhost:15672 (`guest`/`guest`).

## Tests

```bash
# per service
cd services/orders  && npm run lint && npm test && npm run build
cd services/payments && npm run lint && npm test && npm run build
cd services/notifications && npm run lint && npm test && npm run build

# API integration (against a running compose stack)
npx newman run postman/omnistore.postman_collection.json -e postman/omnistore.postman_environment.json
```

The unit suites cover the orders service (emit, unknown SKU, lookup) and the payments consumer
(ack+emit, duplicate drop, retry header, dead-letter).

## CI/CD

- **`.github/workflows/ci.yml`** — on push/PR: lint + unit tests + build for each service
  (matrix), a `docker compose` + Newman integration run, and a SonarCloud scan.
- **`.github/workflows/deploy.yml`** — on push to `master`: builds the four images, pushes to
  Artifact Registry and deploys to Cloud Run, authenticated keylessly via WIF. Strapi deploys
  first so its URL can be injected into `orders`.

## Deployment

The app runs on Cloud Run. One-time bootstrap (mirrors the `booking-saas` infra):

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # fill project_id, region, github_repo
terraform init && terraform apply
```

`terraform apply` outputs the values to wire into GitHub **variables** and **secrets**
(Settings → Secrets and variables → Actions):

| Variable | Terraform output |
|---|---|
| `WIF_PROVIDER` | `workload_identity_provider` |
| `GCP_SA` | `service_account_email` |
| `AR_HOST` | `artifact_registry_host` |
| `AR_BASE` | `artifact_registry_base` |
| `REGION` | `southamerica-east1` |

| Secret | Value |
|---|---|
| `RABBITMQ_URL` | `amqp://user:pass@<broker>:5672` (managed broker or self-hosted) |
| `STRAPI_APP_KEYS` | comma-separated app keys |
| `STRAPI_API_TOKEN_SALT`, `STRAPI_ADMIN_JWT_SECRET`, `STRAPI_TRANSFER_TOKEN_SALT`, `STRAPI_JWT_SECRET`, `STRAPI_ENCRYPTION_KEY` | Strapi secrets |
| `SONAR_TOKEN` | SonarCloud token (CI) |

Then every push to `master` (or a manual `workflow_dispatch`) builds and deploys. Service URLs
are in the deploy job log or via `gcloud run services list --region southamerica-east1`.

## Scope notes (read before an interview)

- **SonarCloud is SonarQube's SaaS.** The repo demonstrates the SonarQube *quality gate* via
  SonarCloud; it does not operate a self-hosted SonarQube server.
- **SoapUI is not included.** Postman/Newman covers the API-testing requirement in the JS
  ecosystem; SoapUI would be redundant and is legacy.
- **Idempotency is in-memory** (single consumer instance) — honest for a demo, not production.
- **Strapi uses SQLite on Cloud Run** and re-seeds the catalog on bootstrap, so cold starts are
  self-healing. Production would use managed Postgres and Cloud Storage for uploads.
- **AMQP consumers on Cloud Run** run with `--min-instances=1 --max-instances=1` and a `/health`
  HTTP endpoint; a production deployment of long-lived consumers would prefer GKE.
