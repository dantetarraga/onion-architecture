# Smart Parking System

Sistema Inteligente de Gestión de Estacionamientos construido con **Onion Architecture**: las políticas de negocio (asignación de cocheras, tarifas, reservas, control de acceso) viven en el dominio y son intercambiables sin tocar infraestructura, API o frontend.

## Stack

- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL + JWT (jose) + WebSockets (Socket.io) + `@nestjs/schedule` + Swagger.
- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4 + Zustand + Axios + `socket.io-client`.
- **Infra:** Docker Compose (Postgres, backend, frontend).

## Estructura

```
smart-parking-system/
├── backend/    # NestJS — domain / application / infrastructure / presentation
├── frontend/   # React + Vite + Tailwind + Zustand
├── docs/       # demo-runbook.md
└── docker-compose.yml
```

Ver `backend/src/domain` para las 5 políticas de negocio (`SlotAssignmentPolicy`, `PricingPolicy`, `ReservationPolicy`, `ParkingPolicy`, `PaymentMethod`) y sus implementaciones default en `domain/policies/impl`.

## Quick start (desarrollo local)

```bash
cp .env.example .env

# Base de datos
docker compose up -d postgres

# Backend
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev        # http://localhost:3000  (Swagger en /docs)

# Frontend (otra terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
```

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
