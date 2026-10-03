# Smart Parking System

Sistema Inteligente de Gestión de Estacionamientos construido con **Onion Architecture**: las políticas de negocio (asignación de cocheras, tarifas, reservas, control de acceso) viven en el dominio y son intercambiables sin tocar infraestructura, API o frontend.

## Stack

- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL + JWT (jose) + WebSockets (Socket.io) + `@nestjs/schedule` + Swagger.
- **Mensajería:** **RabbitMQ** (`amqplib`) como cola de solicitudes de reserva y **Kafka** (`kafkajs`) como bus de correo y eventos de auditoría. Roles distintos a propósito: una solicitud la procesa **un** worker (ack o DLQ), un evento lo leen **N** consumidores.
- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4 + Zustand + Axios + `socket.io-client`.
- **Infra:** Docker Compose (4 Postgres —negocio, auth, pagos, auditoría—, Kafka + Kafka UI, RabbitMQ + UI de gestión, gateway, auth-service, backend, worker de reservas, payments-service, realtime-service, notifications-service, audit-service, frontend) + **Prometheus** y **Grafana** para métricas.

## Estructura

```
smart-parking-system/
├── gateway/                # Única puerta pública (:3000). Auth por gRPC; el resto, proxy HTTP por path
├── auth-service/           # Usuarios, JWT RS256, Google, Facebook, MFA TOTP — base propia (auth-postgres)
├── backend/                # Sucursales, cocheras, reservas, sesiones y tarifa (PricingPolicy)
│   └── src/bootstrap/      main.ts (HTTP + gRPC ParkingService) · worker-main.ts (consumidor de RabbitMQ)
├── payments-service/       # Cobro por método y reporte de ingresos — base propia (payments-postgres)
├── realtime-service/       # socket.io (/realtime): reemite el exchange `realtime.events` a las salas
├── notifications-service/  # Consumidor de Kafka -> correo de confirmación
├── audit-service/          # Consumidor Kafka -> historial de eventos (audit-postgres)
├── observability/          # Prometheus (scrape + alertas) y Grafana (datasource + dashboard provisionados)
├── proto/                  # Contratos gRPC (fuente única): auth · payments · parking
├── frontend/               # React + Vite + Tailwind + Zustand
├── docs/
└── docker-compose.yml
```

### Microservicios y cómo se hablan

| Servicio | Dueño de | Entra por | Llama a |
|---|---|---|---|
| `gateway` | — | HTTP público :3000 | auth-service (gRPC), backend / payments-service / realtime-service / audit-service (proxy HTTP y WebSocket) |
| `auth-service` | `users` | gRPC `AuthService` | — |
| `backend` | `branches`, `parking_slots`, `reservations`, `parking_sessions` | HTTP (vía gateway) · gRPC `ParkingService` | auth-service y payments-service (gRPC), RabbitMQ, Kafka |
| `reservations-worker` | (mismo código que backend) | cola `reservations.requests` | igual que backend |
| `payments-service` | `payments` | HTTP `/payments`, `/users/me/payments` (vía gateway) · gRPC `PaymentsService` | backend (gRPC, cotización), RabbitMQ |
| `realtime-service` | — (sin base) | socket.io `/realtime` (vía gateway) | consume `realtime.events` |
| `notifications-service` | — | tópico Kafka | SMTP |
| `audit-service` | `audit_events` | tópico `business.audit.events` · HTTP `/audit/events` (vía gateway) | PostgreSQL propio |

Las URLs públicas no cambiaron: el frontend sigue hablando solo con `:3000`. Después de editar
cualquier `.proto` en `proto/`, correr `node scripts/sync-proto.js` para copiarlo a cada servicio
(`--check` falla si alguna copia quedó desactualizada).

El flujo de reserva es asíncrono: `POST /reservations` encola la solicitud y responde `202 { requestId }`;
el worker la procesa y el desenlace vuelve al navegador por WebSocket (`reservation.request.resolved`).
Ver [`docs/arquitectura-hexagonal.md`](docs/arquitectura-hexagonal.md), secciones 4 y 5.

El historial de auditoría consume `reservation.created`, `reservation.cancelled` y
`payment.registered` desde `business.audit.events`; administración consulta
`GET /audit/events?limit=50` con un JWT de rol `ADMIN`. La persistencia es independiente y la
publicación es best-effort en esta primera versión (sin outbox).

Ver `backend/src/core/domain` para las 5 políticas de negocio (`SlotAssignmentPolicy`, `PricingPolicy`, `ReservationPolicy`, `ParkingPolicy`, `PaymentMethod`) y sus implementaciones default en `domain/policies/impl`.

## Quick start (desarrollo local)

```bash
cp .env.example .env

# Infraestructura (Postgres, Kafka, RabbitMQ)
cd backend
docker compose -f docker-compose.dev.yml up -d

# Backend — API
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev         # http://localhost:3000  (Swagger en /docs)

# Backend — worker de reservas (otra terminal)
npm run start:worker:dev  # sin él las solicitudes se quedan en la cola

# Frontend (otra terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
```

UIs de inspección: RabbitMQ en http://localhost:15672 (`parking` / `parking`), Kafka en http://localhost:8080.

Usuarios de prueba (sembrados por `prisma/seed.ts`):
- Admin: `admin@parking.com` / `Admin123!`
- Usuario: `user@parking.com` / `User123!`

## Quick start (Docker Compose completo)

```bash
cp .env.example .env
docker compose up --build
```

## Observabilidad (Prometheus + Grafana)

Los servicios instrumentados (gateway, auth, backend, reservations-worker, payments, realtime, notifications) exponen
`GET /metrics` con `prom-client` en su puerto interno `9464`; Prometheus los descubre por DNS (incluidas
las réplicas de `--scale`) y también lee las colas de RabbitMQ. `audit-service` aún no publica métricas en esta primera versión.

- Grafana: http://localhost:3100 (`admin` / `admin`) → dashboard **Smart Parking - Microservicios**, ya provisionado.
- Prometheus: http://localhost:9090 (targets en `/targets`, alertas en `/alerts`).

Qué se mide y cómo leer cada panel: [`docs/observabilidad.md`](docs/observabilidad.md).

## Tests

```bash
cd backend
npm test
```

## Documentación

- [`docs/arquitectura-microservicios.md`](docs/arquitectura-microservicios.md) — mapa de servicios, rutas del gateway, gRPC/RabbitMQ/Kafka y qué pasa si cae cada servicio. Estado del backend en [`backend/README.md`](backend/README.md).
- [`docs/arquitectura-hexagonal.md`](docs/arquitectura-hexagonal.md) — por qué cada pieza es un puerto `in` u `out`, y las decisiones de clasificación que no se derivan mecánicamente de la estructura.
- [`docs/anatomia-cola-reservas.md`](docs/anatomia-cola-reservas.md) — qué hace y cómo funciona cada archivo del flujo asíncrono de reservas sobre RabbitMQ, ordenado por el camino que recorre un mensaje.
- [`docs/login-google-firebase.md`](docs/login-google-firebase.md) — cómo se implementó el login con Google: verificación del ID token con `jose` + JWKS (sin `firebase-admin`), vinculación por email y config de Firebase.
- [`docs/login-facebook.md`](docs/login-facebook.md) — cómo se implementó el login con Facebook sin Firebase: verificación del access token contra la Graph API (`/debug_token` + `/me`), por qué aquí sí hay un secreto y cómo configurar la app de Facebook.
- [`docs/mfa-totp.md`](docs/mfa-totp.md) — verificación en dos pasos con Google Authenticator (TOTP, RFC 6238) sin ninguna cuenta ni credencial externa: cómo se engancha a los tres logins, secreto cifrado, anti-replay, backup codes y rate limit.
- [`docs/observabilidad.md`](docs/observabilidad.md) — métricas de cada microservicio (HTTP, gRPC, colas y negocio), cómo las recoge Prometheus, el dashboard de Grafana y las alertas.
- [`docs/demo-runbook.md`](docs/demo-runbook.md) — checklist paso a paso de la demostración en vivo.
