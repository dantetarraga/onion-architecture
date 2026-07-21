# Runbook de demostración — Smart Parking System

Checklist calcado de la sección 12 del documento de requerimientos, para ensayar antes de la sustentación.

## 0. Reset de datos antes de cada ensayo

```bash
docker compose down -v
docker compose up -d postgres
cd backend
npx prisma migrate reset --force
```

**Para desarrollo local del backend solo** (sin buildear imágenes de backend/frontend), usar en su lugar
`backend/docker-compose.dev.yml`, que levanta únicamente Postgres en el puerto `5434` (igual que `DATABASE_URL`
en `.env.example`):

```bash
cd backend
cp ../.env.example .env   # o crear .env con los mismos valores
docker compose -f docker-compose.dev.yml up -d
npx prisma migrate deploy
npm run seed
npm run start:dev
```

(El reset pedirá confirmación por consentimiento humano si se ejecuta con un agente de IA — es normal, correrlo manualmente no la pide.)

Usuarios sembrados:
- Admin: `admin@parking.com` / `Admin123!`
- Usuario: `user@parking.com` / `User123!`

## 1. Levantar el stack

```bash
# raíz del repo
cp .env.example .env   # o revisar valores existentes
docker compose up -d postgres
cd backend && npm run start:dev     # http://localhost:3000, Swagger en /docs
cd ../frontend && npm run dev       # http://localhost:5173
```

## 2. Checklist de la demo en vivo

1. **Registro e inicio de sesión** — crear un usuario nuevo en `/register`, luego iniciar sesión.
2. **Creación de una reserva** — pestaña "Sucursales", elegir una sucursal y opcionalmente un tipo de cochera, confirmar.
3. **Asignación automática de una cochera** — verificar en la respuesta que el sistema asignó una cochera concreta sin que el usuario la eligiera.
4. **Visualización del mapa del estacionamiento** — la tarjeta de la sucursal debe mostrar el chip de ocupación (verde/amarillo/rojo) actualizándose en tiempo real (abrir dos pestañas del navegador para verlo).
5. **Ingreso mediante QR** — pestaña "Mi reserva" → "Ver QR de ingreso" → "Simular escaneo de ingreso".
6. **Cambio del estado de la cochera en tiempo real** — la sucursal debe pasar a "Ocupada"/nivel de ocupación superior en la otra pestaña abierta.
7. **Inicio del contador de permanencia** — la sesión activa muestra `entryAt`.
8. **Cálculo automático del monto** — se muestra el monto a pagar (tarifa por hora de la sucursal).
9. **Pago desde la aplicación** — botón "Pagar (mock)"; debe aprobarse automáticamente.
10. **Salida mediante QR** — "Ver QR de salida" → "Simular escaneo de salida". Si se intenta antes de pagar, debe rechazarse (403 `PAYMENT_NOT_APPROVED`).
11. **Liberación automática de la cochera** — tras la salida, la cochera vuelve a "Disponible" y el nivel de ocupación baja.

## 3. Casos adicionales para preguntas del jurado

- **Política 3 (una reserva activa):** intentar crear una segunda reserva con el mismo usuario mientras la primera sigue pendiente → `409 RESERVATION_ALREADY_ACTIVE`.
- **Política 1 completa (sugerencia entre sucursales):** iniciar sesión como admin, usar `POST /admin/branches/:id/simulate-full` sobre una sucursal, luego crear una reserva en esa sucursal como usuario → la respuesta debe traer `SUGGEST_OTHER_BRANCH` con la sucursal más cercana (fórmula de Haversine) y su distancia en km.
- **Política 1, estrategia intercambiable (E1 — Onion en vivo):** con el backend apagado, cambiar `SLOT_ASSIGNMENT_STRATEGY=balanced` en `.env` y reiniciar (`npm run start:dev`). Sin tocar ningún otro archivo, la asignación dentro de una sucursal ahora reclama la cochera menos usada recientemente en vez de la primera por código (verificable comparando el `slotId` devuelto en dos reservas sucesivas), y la sugerencia cross-sucursal deja de ordenar solo por distancia y pasa a penalizar sucursales con mayor ocupación (útil como argumento en vivo de la sección 13 del documento base: mismo caso de uso, mismo controller, misma persistencia — solo cambia una variable de entorno).
- **Política 2 y 7 (expiración automática):** `POST /admin/reservations/expire-now` fuerza el mismo caso de uso que corre el `@Cron` cada minuto, sin esperar los 20 minutos reales. Para verlo con el cron real, bajar `RESERVATION_TOLERANCE_MINUTES=1` en `.env` antes de levantar el backend.
- **Dashboard admin:** pestaña "Administración" (solo visible con `admin@parking.com`) muestra ocupación por sucursal y reporte de ingresos, y permite simular sucursal llena.

## 4. Verificación vía Swagger (sin frontend)

Abrir `http://localhost:3000/docs`, autenticar con el botón "Authorize" usando el token devuelto por `POST /auth/login`, y repetir la secuencia de la sección 2 directamente contra la API.
