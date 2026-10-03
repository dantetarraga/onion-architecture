# Arquitectura de microservicios

Estado de la migración del monolito a microservicios. Cada servicio sigue siendo hexagonal por
dentro (ver [`arquitectura-hexagonal.md`](arquitectura-hexagonal.md)); este documento explica cómo
se reparten las responsabilidades **entre** servicios y cómo se comunican.

## Vista general

```
                                   navegador (frontend :5173)
                                              │  REST + socket.io, siempre a :3000
                                              ▼
                                  ┌───────────────────────┐
                                  │        gateway        │  única puerta pública
                                  └───────────────────────┘
       gRPC AuthService │     HTTP /payments*    │   HTTP resto   │   /socket.io (HTTP + WS)
                        ▼     /users/me/payments ▼                ▼                ▼
               ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
               │ auth-service │  │ payments-service │  │     backend      │  │ realtime-service │
               └──────┬───────┘  └───┬──────────▲───┘  └───┬──────────▲───┘  └────────▲─────────┘
                      │              │  gRPC    │ gRPC     │          │               │
                 auth-postgres       │ Parking  │ Payments │          │               │
                                     │ Service  │ Service  │          │               │
                           payments-postgres    └──────────┤          │               │
                                     │                     │     postgres (negocio)   │
                                     │                     │                          │
                                     └─────────────────────┴──► RabbitMQ realtime.events (fanout)
                                                           │
                                   RabbitMQ reservations.requests ──► reservations-worker
                                                           │
                                 Kafka notifications.email.confirmation ──► notifications-service
```

## Servicios

| Servicio | Responsabilidad | Base de datos | Entrada | Tecnología |
|---|---|---|---|---|
| `gateway` | Punto de entrada público. Resuelve auth por gRPC y reenvía el resto según el path | — | HTTP :3000 | NestJS + http-proxy-middleware |
| `auth-service` | Usuarios, login local/Google/Facebook, MFA TOTP y firma de JWT RS256 | `auth-postgres` (`users`) | gRPC `AuthService` :50051 | NestJS + Prisma |
| `backend` | Sucursales, cocheras, reservas, sesiones y tarifa. Ver [`backend/README.md`](../backend/README.md) | `postgres` (`smart_parking`) | HTTP :3001 · gRPC `ParkingService` :50053 | NestJS + Prisma |
| `reservations-worker` | Procesa las solicitudes de reserva encoladas (mismo código que backend) | `postgres` (compartida con backend, es el mismo servicio lógico) | cola `reservations.requests` | NestJS |
| `payments-service` | Cobro por método (mock de efectivo/tarjeta/Yape/Plin), historial y montos por sucursal | `payments-postgres` (`payments`) | HTTP :3020 · gRPC `PaymentsService` :50052 | NestJS + Prisma |
| `realtime-service` | socket.io `/realtime`: reenvía eventos a las salas de sucursal, usuario y admin | — | socket.io :3030 · exchange `realtime.events` | Node + socket.io |
| `notifications-service` | Envía el correo de confirmación de reserva | — | tópico Kafka | Node + kafkajs |
| `audit-service` | Historial inmutable de reservas y pagos | `audit-postgres` (`audit_events`) | tópico Kafka `business.audit.events` · HTTP `/audit/events` | Node + kafkajs + PostgreSQL |

Ningún servicio lee la base de otro. Entre bases no hay FK: `userId`, `sessionId` y `branchId`
viajan como ids opacos.

## Rutas públicas (gateway)

El frontend usa las mismas URLs que usaba con el monolito.

| Ruta | Destino |
|---|---|
| `/auth/*`, `GET /users/me` | gateway → auth-service (gRPC) |
| `POST /payments`, `GET /payments/:id`, `GET /users/me/payments` | payments-service (HTTP) |
| `/socket.io/*` (polling y upgrade a WebSocket) | realtime-service |
| `GET /audit/events` | audit-service (solo JWT con rol `ADMIN`) |
| Todo lo demás (`/branches`, `/reservations`, `/parking`, `/admin`, `/users/me/reservations`, `/users/me/sessions`) | backend (HTTP) |

Cada servicio que recibe tráfico de usuario vuelve a verificar el JWT RS256 con `JWT_PUBLIC_KEY`.
Solo auth-service tiene `JWT_PRIVATE_KEY`.

## Estilos de comunicación y por qué

| Mecanismo | Se usa para | Por qué ese |
|---|---|---|
| **gRPC** (síncrono) | auth (login/MFA/usuario), cotizar una sesión, consultar si una sesión está pagada, montos por sucursal | El que llama necesita la respuesta para decidir en el momento (p. ej. no se libera una cochera sin confirmar el pago) |
| **RabbitMQ, cola de trabajo** `reservations.requests` | Solicitudes de reserva | Cada solicitud la procesa **un** worker (ack o DLQ). Con `prefetch=1` se evita que dos usuarios reclamen la misma cochera |
| **RabbitMQ, fanout** `realtime.events` | Eventos para el navegador | Cada instancia de realtime-service recibe una copia y atiende a sus sockets. Si se pierde un evento no pasa nada grave |
| **Kafka** `notifications.email.confirmation` | Correo de confirmación | Bus de eventos: podría tener N consumidores independientes |
| **Kafka** `business.audit.events` | Historial de reservas y pagos | Consumidor independiente; su publicación es best-effort en esta primera versión |

Contratos:
- gRPC: `proto/auth.proto`, `proto/payments.proto` y `proto/parking.proto` son la fuente única.
  `node scripts/sync-proto.js` los copia a cada servicio que los usa, y `--check` falla si alguna
  copia quedó desactualizada.
- Tiempo real: `{ event, target: branch|user|admin, payload }`, documentado en
  `realtime-service/src/types.ts`.
- Correo: `notifications-service/src/types.ts`.
- Auditoría: contrato JSON validado por `audit-service/src/types.ts`.

Los productores no bloquean una reserva o un pago si Kafka falla, pero esta versión no usa outbox:
un fallo al publicar puede dejar una operación sin registro de auditoría. Kafka conserva eventos ya
publicados mientras `audit-service` está caído; al iniciar, el consumidor nuevo lee el tópico desde
el principio y la clave primaria `event_id` evita duplicados.

## Flujos principales

### Reservar
1. `POST /reservations` → backend encola en `reservations.requests` y responde `202 { requestId }`.
2. El worker crea la reserva. Publica `reservation.request.resolved` (a la sala del usuario),
   `slot.status.changed` y `branch.occupancy.updated` (a la sucursal) en `realtime.events`, y el
   correo en Kafka. Para el correo pide email y nombre a auth-service por gRPC.
3. realtime-service reenvía cada evento a los navegadores.

### Pagar y salir
1. `GET /parking/sessions/:id/amount` → backend calcula la tarifa (`PricingPolicy`).
2. `POST /payments` → payments-service pide la cotización a backend
   (`ParkingService.GetSessionQuote`), valida que la sesión sea del usuario, cobra, guarda el pago
   con su `branchId` y publica `payment.registered` (solo a la sala de admin).
3. `POST /parking/exit` → backend consulta `PaymentsService.GetPaymentBySession`. Si no hay pago
   aprobado responde 403. Si hay sobre-estadía no cubierta, también rechaza. Si todo está en orden,
   libera la cochera y publica los eventos de salida.

### Reporte de ingresos
`GET /admin/reports/revenue` → backend lee sus sucursales y pide los montos de todas en una sola
llamada (`PaymentsService.SumApprovedByBranch`).

## Qué pasa si un servicio se cae

| Caído | Efecto |
|---|---|
| payments-service | No se puede pagar (el gateway responde 504). La salida y el reporte de ingresos responden **503** `PAYMENT_SERVICE_UNAVAILABLE`. Reservar y entrar siguen funcionando |
| backend | No se puede pagar: payments-service responde **503** `PARKING_SERVICE_UNAVAILABLE`. El historial `GET /users/me/payments` sigue funcionando |
| realtime-service | La app funciona pero sin actualizaciones en vivo. Los eventos publicados mientras está caído se pierden (no se acumulan) |
| RabbitMQ | Las reservas nuevas responden 503. El resto sigue, sin eventos en vivo |
| Kafka / notifications-service | No salen correos. La reserva se confirma igual |
| audit-service | El negocio sigue funcionando; Kafka conserva los eventos para que el consumidor los procese al volver |
| auth-service | No hay login. Los tokens ya emitidos siguen siendo válidos hasta que expiran (se verifican localmente) |

## Historial de la migración

| Paso | Qué salió del monolito |
|---|---|
| 1 | `notifications-service` (correo por Kafka) |
| 2 | `auth-service` + `gateway` (usuarios y JWT; el gateway pasa a ser la entrada única) |
| 3 | `payments-service` (tabla `payments`, métodos de pago, `/payments`) |
| 4 | `realtime-service` (socket.io; backend solo publica eventos) |
| 5 | `audit-service` (historial de reservas y pagos por Kafka) |

Lo que queda en backend es el núcleo transaccional (sucursales, cocheras, reservas y sesiones), que
conviene mantener junto. El razonamiento está en
[`backend/README.md`](../backend/README.md#por-qué-no-se-separa-más). Posibles siguientes pasos:
un servicio de reportes con vista propia alimentada por eventos (CQRS), o un catálogo de
sucursales y tarifas de solo lectura.
