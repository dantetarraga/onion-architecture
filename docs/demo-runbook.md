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
`backend/docker-compose.dev.yml`, que levanta la infraestructura (Postgres en el puerto `5434`, igual que
`DATABASE_URL` en `.env.example`, más Kafka y RabbitMQ) sin buildear las imágenes de la aplicación:

```bash
cd backend
cp ../.env.example .env   # o crear .env con los mismos valores
docker compose -f docker-compose.dev.yml up -d
npx prisma migrate deploy
npm run seed
npm run start:dev          # terminal 1 — API (HTTP + WebSocket)
npm run start:worker:dev   # terminal 2 — worker de reservas (consume RabbitMQ)
```

El worker es un **segundo proceso obligatorio**: sin él las solicitudes se quedan encoladas y ninguna
reserva llega a crearse. Es justamente lo que se aprovecha para la demo de la sección 3.

(El reset pedirá confirmación por consentimiento humano si se ejecuta con un agente de IA — es normal, correrlo manualmente no la pide.)

Usuarios sembrados:
- Admin: `admin@parking.com` / `Admin123!`
- Usuario: `user@parking.com` / `User123!`

## 1. Levantar el stack

```bash
# raíz del repo
cp .env.example .env   # o revisar valores existentes
docker compose up -d --build
```

Levanta todo: Postgres, Kafka (+ Kafka UI en `:8080`), RabbitMQ (+ UI de gestión en `:15672`), el API
(`:3000`, Swagger en `/docs`), el worker de reservas y el frontend (`:5173`).

## 2. Checklist de la demo en vivo

1. **Registro e inicio de sesión** — crear un usuario nuevo en `/register`, luego iniciar sesión.
2. **Creación de una reserva** — pestaña "Sucursales", elegir una sucursal y opcionalmente un tipo de cochera, confirmar. La respuesta HTTP es `202 Accepted` con un `requestId`: la solicitud entró a la cola de RabbitMQ y el modal queda en "Solicitud en cola, procesando…" hasta que el worker la resuelve y el resultado vuelve por WebSocket (normalmente < 1 s).
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
- **Política 5, anti-replay de QR (E2):** con una sesión ya activa (post "Simular escaneo de ingreso"), volver a llamar "Simular escaneo de ingreso" con el mismo QR de entrada (o reenviar el mismo `POST /parking/entry`) → `409 SESSION_ALREADY_ACTIVE`, sin crear una segunda sesión para la misma reserva. Verificable también consultando que solo existe una fila `ACTIVE` en `parking_sessions` para esa `reservationId`.
- **Política 4, sobre-estadía / pago insuficiente (E3):** con una sesión activa ya pagada por una estadía corta, forzar que pase tiempo suficiente (o retrasar `entryAt` en la base para el ensayo) y luego intentar "Simular escaneo de salida" → `402 OVERSTAY_PAYMENT_INSUFFICIENT` con el monto exacto que falta; la cochera NO se libera. Pagar de nuevo desde la app ("Pagar (mock)") registra solo la diferencia (top-up sobre el mismo pago, no uno nuevo — `payments.sessionId` es único) y el siguiente intento de salida procede normalmente.
- **Revalidación en cascada al confirmar sucursal sugerida (E4):** `POST /reservations/confirm-suggestion` reusa `CreateReservationUseCase` completo, así que si la sucursal sugerida (B) también se llenó mientras el usuario decidía, automáticamente vuelve a sugerir la siguiente más cercana con cupo (C), en vez de fallar. Cubierto por test explícito (`create-reservation.use-case.spec.ts`) que documenta A→B→C.
- **Métodos de pago múltiples, Strategy (E5):** en "Mi reserva" con sesión activa, el desplegable "Método de pago" permite elegir Efectivo/Tarjeta/Yape/Plin antes de pulsar "Pagar (mock)"; la respuesta trae `externalReference` con el prefijo correspondiente (`CASH-`, `CARD-`, `YAPE-`, `PLIN-`), demostrando que `PaymentMethodRouterAdapter` despacha al mini-adapter correcto sin que `RegisterPaymentUseCase` conozca los proveedores concretos.
- **Política 2 y 7 (expiración automática):** `POST /admin/reservations/expire-now` fuerza el mismo caso de uso que corre el `@Cron` cada minuto, sin esperar los 20 minutos reales. Para verlo con el cron real, bajar `RESERVATION_TOLERANCE_MINUTES=1` en `.env` antes de levantar el backend.
- **Dashboard admin:** pestaña "Administración" (solo visible con `admin@parking.com`) muestra ocupación por sucursal y reporte de ingresos, y permite simular sucursal llena.
- **Cola de solicitudes vía RabbitMQ (los dos brokers, roles distintos):** `POST /reservations` ya no crea la reserva dentro del request: publica la solicitud en el exchange `reservations` (routing key `reservation.requested`) y responde `202 Accepted` con un `requestId`. El servicio `reservations-worker` la consume, ejecuta `CreateReservationUseCase` y devuelve el desenlace por WebSocket (`reservation.request.resolved`). **Cómo mostrarlo en vivo, paso a paso:**

  1. Apagar el worker para que el mensaje no se consuma al instante: `docker compose stop reservations-worker`.
  2. En el frontend, crear una reserva. El modal queda en "Solicitud en cola, procesando…" y en la pestaña Network se ve `202 { "requestId": "…" }`.
  3. Abrir **http://localhost:15672** (usuario/clave `parking` / `parking`) → **Queues and Streams** → `reservations.requests`: la columna **Ready** marca **1** y **Consumers** marca **0**.
  4. Entrar a la cola → panel **Get messages** → *Ack Mode:* `Nack message requeue true` → **Get Message(s)**. Se ve el JSON publicado (`requestId`, `userId`, `branchId`, `requestedAt`) y en *Properties* `delivery_mode: 2` (persistente) y `message_id` = el `requestId`. Equivalente por consola: `docker compose exec rabbitmq rabbitmqadmin -u parking -p parking get queue=reservations.requests ackmode=reject_requeue_true`.
  5. Reencender el worker: `docker compose start reservations-worker`. La cola vuelve a **Ready: 0**, el gráfico *Message rates* marca el pico deliver/ack, y en el navegador el modal se cierra solo y salta a "Mi reserva" con la cochera ya asignada.

  Casos de borde para preguntas del jurado:
  - **Rechazo de negocio ≠ fallo**: crear una segunda reserva con el mismo usuario → llega `reservation.request.resolved` con `status: "REJECTED", code: "RESERVATION_ALREADY_ACTIVE"`; el mensaje se ack-ea (no se reintenta) y `reservations.dlq` sigue vacía.
  - **Broker caído**: `docker compose stop rabbitmq` → `POST /reservations` responde `503 RESERVATION_QUEUE_UNAVAILABLE`. Contraste deliberado con Kafka, que solo loguea: sin cola la reserva no va a existir nunca, así que el error sí se propaga. Al reencender el broker, API y worker se reconectan solos (log `Conectado a RabbitMQ`) y el worker se re-suscribe.
  - **Fallo de infraestructura → DLQ**: `docker compose stop postgres` y crear una reserva → el worker hace `nack(requeue: false)` y el mensaje aparece en `reservations.dlq` en la UI, en vez de perderse o reintentarse en bucle.
  - **Competing consumers**: `docker compose up -d --scale reservations-worker=3` → en *Queues → Consumers* aparecen **3** sobre la misma cola, repartiéndose los mensajes.
  - **Por qué `prefetch=1`**: el broker no entrega un mensaje nuevo hasta ack-ear el anterior, así que las solicitudes se procesan de a una y desaparece la carrera de dos usuarios reclamando la misma cochera. Se ajusta con `RABBITMQ_PREFETCH` en `.env`.
- **Correo de confirmación vía Kafka:** al crear una reserva (paso 2), `CreateReservationUseCase` publica un evento en el tópico `notifications.email.confirmation` (puerto `NotificationPublisherPort`, adaptador `KafkaNotificationPublisherAdapter`) con el email y nombre del usuario, la sucursal y la cochera asignada — es el mensaje que un servicio externo de notificaciones consumiría para enviar el correo real. Verificable sin ese servicio: abrir `http://localhost:8080` (Kafka UI, levantado junto con `docker compose up`), entrar al tópico `notifications.email.confirmation` y ver el mensaje JSON recién publicado con el `reservationId` de la reserva creada.

  Los dos brokers no se pisan, resuelven problemas distintos: **RabbitMQ** es la *cola de trabajo* que transporta la **solicitud** hacia un worker que la procesa (un mensaje, un consumidor, ack o DLQ); **Kafka** es el *bus de eventos* que publica la **confirmación** para N consumidores independientes. Por eso el adaptador de Kafka loguea y sigue si el broker está caído (el correo es un efecto secundario) y el de RabbitMQ lanza `503` (sin cola no hay reserva).

## 4. Verificación vía Swagger (sin frontend)

Abrir `http://localhost:3000/docs`, autenticar con el botón "Authorize" usando el token devuelto por `POST /auth/login`, y repetir la secuencia de la sección 2 directamente contra la API.
