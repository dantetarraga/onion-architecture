# Smart Parking System

Sistema Inteligente de Gestión de Estacionamientos construido con **Onion Architecture**: las políticas de negocio (asignación de cocheras, tarifas, reservas, control de acceso) viven en el dominio y son intercambiables sin tocar infraestructura, API o frontend.

## Stack

- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL + JWT (jose) + WebSockets (Socket.io) + `@nestjs/schedule` + Swagger.
- **Mensajería:** **RabbitMQ** (`amqplib`) como cola de solicitudes de reserva y **Kafka** (`kafkajs`) como bus de eventos para el correo de confirmación. Roles distintos a propósito: una solicitud la procesa **un** worker (ack o DLQ), un evento lo leen **N** consumidores.
- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4 + Zustand + Axios + `socket.io-client`.
- **Infra:** Docker Compose (Postgres, Kafka + Kafka UI, RabbitMQ + UI de gestión, API, worker de reservas, frontend).

## Estructura

```
smart-parking-system/
├── backend/    # NestJS — core (domain + application) / adapters (in + out) / bootstrap
│   └── src/bootstrap/  main.ts (API HTTP + WebSocket) · worker-main.ts (consumidor de RabbitMQ)
├── frontend/   # React + Vite + Tailwind + Zustand
├── docs/       # arquitectura-hexagonal.md · demo-runbook.md
└── docker-compose.yml
```

El flujo de reserva es asíncrono: `POST /reservations` encola la solicitud y responde `202 { requestId }`;
el worker la procesa y el desenlace vuelve al navegador por WebSocket (`reservation.request.resolved`).
Ver [`docs/arquitectura-hexagonal.md`](docs/arquitectura-hexagonal.md), secciones 4 y 5.

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

## Tests

```bash
cd backend
npm test
```

## Demo

Ver [`docs/demo-runbook.md`](docs/demo-runbook.md) para el checklist paso a paso de la demostración en vivo.
