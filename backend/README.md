# backend — núcleo de estacionamiento

Estado del backend después de la migración a microservicios (auth-service, payments-service y
realtime-service ya extraídos). Lo que queda aquí es el **núcleo transaccional del negocio**:
sucursales, cocheras, reservas y sesiones de estacionamiento, junto con la tarifa. Estas piezas
se quedan juntas a propósito (ver [Por qué no se separa más](#por-qué-no-se-separa-más)). La vista de
todos los servicios está en [`docs/arquitectura-microservicios.md`](../docs/arquitectura-microservicios.md).

## Qué hace hoy y qué ya no

| Responsabilidad | Dónde vive |
|---|---|
| Sucursales, cocheras, disponibilidad y ocupación | **backend** |
| Reservas (cola asíncrona con RabbitMQ + worker), cancelación y expiración | **backend** |
| Ingreso y salida con QR, sesiones de estacionamiento | **backend** |
| Tarifa (`PricingPolicy`) y `GET /parking/sessions/:id/amount` | **backend** |
| Panel de admin: ocupación, simular sucursal llena, expirar ahora | **backend** |
| Reporte de ingresos (`GET /admin/reports/revenue`) | **backend**, con montos pedidos a payments-service por gRPC |
| Correo de confirmación de reserva | backend publica en Kafka → `notifications-service` envía |
| Usuarios, login (local/Google/Facebook), MFA, emisión de JWT | ~~backend~~ → `auth-service` |
| Cobro, persistencia de pagos, `/payments`, `/users/me/payments` | ~~backend~~ → `payments-service` |
| socket.io (`/realtime`) | ~~backend~~ → `realtime-service` (backend solo publica eventos) |

Backend **no tiene puerto público**. Todo el tráfico del navegador llega por el `gateway` (:3000);
en Docker, backend solo se expone en `127.0.0.1:3001` para depurar.

## Procesos

El mismo build corre como dos procesos:

| Proceso | Entrypoint | Qué levanta |
|---|---|---|
| API (`backend`) | `src/bootstrap/main.ts` | HTTP :3001 (REST + Swagger en `/docs`), gRPC :50053 (`ParkingService`) y el scheduler de expiración de reservas |
| Worker (`reservations-worker`) | `src/bootstrap/worker-main.ts` | Consumidor de la cola `reservations.requests` (sin HTTP, sin gRPC entrante, sin scheduler). Se puede escalar: `--scale reservations-worker=3` |

## Cómo se comunica con el resto

```
                     HTTP (proxy por path)
   gateway ───────────────────────────────────────►  backend  (:3001)
                                                        │
   payments-service ──── gRPC ParkingService ─────────► │  (:50053) cotización de una sesión
                                                        │
   backend ──── gRPC AuthService.GetUserById ─────────► auth-service       (email para el correo)
   backend ──── gRPC PaymentsService ─────────────────► payments-service   (¿sesión pagada? · ingresos)
   backend ──── RabbitMQ reservations.requests ───────► reservations-worker
   backend ──── RabbitMQ realtime.events (fanout) ────► realtime-service ──► navegadores
   backend ──── Kafka notifications.email.confirmation ► notifications-service
```

### Entrante
- **HTTP (vía gateway):** `/branches/*`, `/reservations/*`, `/parking/*`, `/admin/*`,
  `/users/me/reservations`, `/users/me/sessions`. Cada request vuelve a verificar el JWT RS256
  localmente con `JWT_PUBLIC_KEY` (defensa en profundidad; backend nunca firma tokens).
- **gRPC `ParkingService.GetSessionQuote`** (`proto/parking.proto`): payments-service lo llama
  antes de cobrar para saber de quién es la sesión, en qué sucursal está y cuánto cuesta ahora.
  No valida dueño (el llamador es interno); payments-service compara `userId` con el del token.
- **RabbitMQ `reservations.requests`:** solo lo consume el worker.

### Saliente
- **gRPC → auth-service** (`AuthGrpcModule`, puerto `USER_LOOKUP`): email y nombre del usuario
  para el evento del correo de confirmación.
- **gRPC → payments-service** (`PaymentsGrpcModule`, puerto `PAYMENT_LOOKUP`):
  - `GetPaymentBySession`: `RegisterExitUseCase` y `DefaultParkingPolicy` no liberan la cochera
    si la sesión no tiene un pago aprobado que cubra la tarifa (con tolerancia por sobre-estadía).
  - `SumApprovedByBranch`: una sola llamada para todas las sucursales del reporte de ingresos.
  - Si payments-service no responde (timeout de 5 s) se lanza `PaymentServiceUnavailableError`
    → **503**. Nunca se decide una salida "a ciegas".
- **RabbitMQ `realtime.events`** (`RealtimeModule` → `RabbitRealtimePublisherAdapter`, igual en API
  y worker): cada evento viaja como `{ event, target, payload }`, con `target` de tipo
  `branch`, `user` o `admin`. La ocupación de la sucursal se calcula aquí y viaja ya resuelta
  (realtime-service no tiene base de datos). Si RabbitMQ falla se loguea y la operación de negocio
  sigue su curso.
- **Kafka `notifications.email.confirmation`:** confirmación de reserva. También es
  fire-and-forget.

Los `.proto` que usa backend (`proto/auth.proto`, `proto/payments.proto`, `proto/parking.proto`)
son copias de la raíz del repo. Se regeneran con `node scripts/sync-proto.js`, sin editarlas aquí.

## Datos

Base `smart_parking` (servicio `postgres`), de uso exclusivo de backend:

```
Branch ──< ParkingSlot ──< Reservation ──1 ParkingSession
                     └──────────────────────< ParkingSession
```

- `userId` en `reservations` y `parking_sessions` es un id opaco del usuario en auth-service
  (no hay FK entre bases distintas).
- La tabla `payments` ya no existe aquí: la migración `20260925000000_split_payments_service` la
  elimina. **No copia los datos**: si una base tiene pagos que importan, hay que exportarlos a
  payments-service antes de aplicarla (ver el comentario en la migración).
- El seed (`prisma/seed.ts`) crea 3 sucursales con sus cocheras. Los usuarios se siembran en
  auth-service; los pagos no tienen seed.

## Estructura (hexagonal)

```
src/
├── core/                        # sin dependencias de infraestructura
│   ├── domain/                  # entidades, enums, errores, políticas (1 asignación · 2 reservas ·
│   │                            #   4 tarifa · 5-6 ingreso/salida) e implementaciones en policies/impl
│   ├── application/use-cases/   # admin · branches · parking · payments (solo calculate-amount) · reservations
│   └── ports/
│       ├── in/                  # un puerto por caso de uso + tokens
│       └── out/                 # repositorios, clock, qr, realtime, colas, user-lookup, payment-lookup
├── adapters/
│   ├── in/   http · grpc (ParkingGrpcController) · messaging (consumidor de reservas) · scheduler
│   └── out/  persistence/prisma · auth (verificador RS256, cliente gRPC auth) ·
│             payments (cliente gRPC payments) · realtime (publicador RabbitMQ) ·
│             messaging (RabbitMQ, Kafka) · qr · clock
└── bootstrap/                   # módulos Nest: main.ts (API) y worker-main.ts (worker)
```

`core/domain/entities/payment.entity.ts` se conserva solo como **vista de lectura** de lo que
devuelve payments-service (backend ya no crea ni modifica pagos).

## Variables de entorno

| Variable | Uso | En docker-compose |
|---|---|---|
| `DATABASE_URL` | base `smart_parking` | `postgres:5432` |
| `PORT` / `GRPC_PORT` | HTTP / gRPC entrante (solo API) | `3001` / `50053` |
| `JWT_PUBLIC_KEY` | verificar el JWT RS256 (API y worker) | desde `.env` |
| `AUTH_SERVICE_GRPC_URL` | cliente gRPC → auth-service | `auth-service:50051` |
| `PAYMENTS_SERVICE_GRPC_URL` | cliente gRPC → payments-service | `payments-service:50052` |
| `RABBITMQ_URL`, `RABBITMQ_REALTIME_EXCHANGE`, `RABBITMQ_PREFETCH` | cola de reservas y eventos de tiempo real | `rabbitmq:5672`, `realtime.events`, `1` |
| `KAFKA_BROKERS`, `KAFKA_NOTIFICATIONS_TOPIC` | correo de confirmación | `kafka:9092` |
| `RESERVATION_TOLERANCE_MINUTES`, `SLOT_ASSIGNMENT_STRATEGY` | políticas 2 y 1 | `20`, `default` |

## Correr en local

```bash
# Infra de desarrollo: Postgres (negocio y pagos), Kafka, RabbitMQ
docker compose -f docker-compose.dev.yml up -d

npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev          # API: http://localhost:3001 (Swagger en /docs), gRPC en :50053
npm run start:worker:dev   # worker (otra terminal)
npm test
```

Para los flujos completos (login, pagos, sockets) hacen falta auth-service, payments-service,
realtime-service y gateway. Lo más simple es levantar toda la pila desde la raíz con
`docker compose up --build`.

## Por qué no se separa más

Sucursales, cocheras, reservas y sesiones cambian juntas en operaciones que tienen que ser
atómicas: reclamar una cochera libre al reservar (`claimAvailableSlot`), marcarla ocupada al
entrar, liberarla al salir o al expirar la reserva. Separarlas en servicios distintos obligaría a
coordinar cada flujo con sagas y compensaciones, mucha complejidad para muy poco beneficio. Si
más adelante hiciera falta, el corte más limpio sería un catálogo de sucursales y tarifas de solo
lectura.
