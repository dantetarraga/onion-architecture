# Arquitectura Hexagonal (Ports & Adapters) — SIGE

Este documento explica la reorganizacion del backend de Onion Architecture a
Arquitectura Hexagonal (tambien llamada Ports & Adapters, de Alistair
Cockburn). El objetivo es **didactico**: mostrar como el mismo dominio de
negocio (Sucursales, Estacionamiento, Reservas, Pagos) se puede empaquetar
con dos convenciones de carpetas distintas sin cambiar ni una regla de
negocio.

## 1. La idea central

Onion y Hexagonal comparten la regla de dependencia ("lo de adentro no
conoce lo de afuera"), pero organizan el codigo con una logica distinta:

- **Onion**: anillos concentricos. Cuanto mas adentro, mas puro
  (`domain` -> `application` -> `infrastructure`/`presentation`).
- **Hexagonal**: un solo limite. Adentro esta el **nucleo** (dominio + casos
  de uso). Todo lo de afuera es un **adaptador** enchufado a un **puerto**.
  Los puertos se clasifican por **direccion**, no por capa:
  - **`in` (driving)**: algo de afuera activa al nucleo (un controller HTTP,
    un cron, un mensaje de cola).
  - **`out` (driven)**: el nucleo necesita algo de afuera y lo pide a traves
    de una interfaz (una base de datos, un servicio de pagos, un JWT).

La pregunta que define si algo es un puerto "in" o "out" no es la
tecnologia, es **quien llama a quien**. Ver la seccion 4 para un caso que
sorprende con esto (el notificador de WebSocket).

## 2. Estructura de carpetas

```
backend/src/
  core/                         <- el hexagono (cero imports de NestJS/Express/Prisma en domain)
    domain/
      entities/                 Branch, ParkingSlot, ParkingSession, Reservation, Payment, User...
      enums/
      errors/
      policies/                 Reglas de negocio con implementacion intercambiable (Strategy)
        parking.policy.ts / impl/default-parking.policy.ts
        pricing.policy.ts / impl/hourly-pricing.policy.ts
        reservation.policy.ts / impl/default-reservation.policy.ts
        slot-assignment.policy.ts / impl/{default,balanced}-slot-assignment.policy.ts
        policy-tokens.ts        Simbolos de DI para elegir la implementacion de cada policy
    application/
      use-cases/                Un caso de uso = una operacion de negocio completa
        auth/ admin/ branches/ parking/ payments/ reservations/ users/
      shared/
    ports/
      in/                       Interfaces que el nucleo EXPONE hacia afuera (25 puertos, 1 por caso de uso)
        tokens.ts                Simbolos de DI (p.ej. CREATE_RESERVATION)
      out/                      Interfaces que el nucleo NECESITA del exterior
        *.repository.port.ts, clock.port.ts, qr-code.port.ts, token.port.ts,
        password-hasher.port.ts, realtime-notifier.port.ts, payment-method.port.ts,
        notification-publisher.port.ts, reservation-request-queue.port.ts,
        tokens.ts

  adapters/
    in/                         Algo de afuera DISPARA al nucleo
      http/                     Controllers, DTOs, guards, decorators, filtro de excepciones
      messaging/                Consumidores de RabbitMQ (cola de solicitudes de reserva, relay de tiempo real)
      scheduler/                Cron que dispara ExpireOverdueReservationsUseCase cada minuto
      websocket/                events.gateway.ts: autentica sockets y gestiona salas (join/leave branch, user:<id>)
    out/                        El nucleo PIDE algo a afuera
      persistence/prisma/       Repositorios Prisma (implementan los *.repository.port.ts)
      auth/                     JWT (TokenPort) y bcrypt (PasswordHasherPort)
      qr/                       HMAC (QrCodePort)
      payments/                 Efectivo/Tarjeta/Yape/Plin (PaymentMethod, Strategy + Router)
      clock/                    Reloj del sistema (ClockPort)
      realtime/                 Empuja eventos a los sockets (RealtimeNotifierPort)
      messaging/                Kafka (NotificationPublisherPort) y RabbitMQ
                                (ReservationRequestQueuePort + relay de RealtimeNotifierPort)

  bootstrap/                    Composition root: modulos de NestJS, wiring de DI
                                main.ts        -> proceso API (HTTP + WebSocket)
                                worker-main.ts -> proceso worker (consume la cola de reservas)
```

## 3. Los 25 puertos "in": por que existen

En el codigo original (y en muchas implementaciones "pragmaticas" de
hexagonal), el controller inyecta directamente la clase concreta del caso de
uso: `constructor(private readonly createReservation: CreateReservationUseCase)`.
Funciona, pero el controller termina acoplado a una **clase**, no a un
**contrato**.

Para este ejercicio didactico se formalizo el puerto "in" de cada caso de
uso como una interfaz explicita en `core/ports/in/`, por ejemplo:

```ts
// core/ports/in/reservations/create-reservation.port.ts
export interface CreateReservationPort {
  execute(input: CreateReservationInput): Promise<CreateReservationResult>;
}
```

y el caso de uso la implementa:

```ts
export class CreateReservationUseCase implements CreateReservationPort { ... }
```

El controller ya no conoce la clase concreta, solo el puerto y su token de
DI:

```ts
constructor(
  @Inject(CREATE_RESERVATION) private readonly createReservation: CreateReservationPort,
) {}
```

`bootstrap/reservations.module.ts` es quien conecta ambos extremos:

```ts
providers: [
  CreateReservationUseCase,
  { provide: CREATE_RESERVATION, useExisting: CreateReservationUseCase },
]
```

**Excepcion deliberada**: cuando un caso de uso llama a *otro* caso de uso
directamente (p.ej. `GetOccupancyDashboardUseCase` llama a
`CompareBranchesOccupancyUseCase`), esa dependencia sigue siendo la clase
concreta, sin puerto. Es una colaboracion interna del nucleo, no cruza la
frontera hexagono/adaptador, asi que formalizarla como puerto seria
ceremonia sin beneficio.

## 4. Decisiones de clasificacion (y por que)

Estas fueron las llamadas de juicio que no se derivan mecanicamente de la
estructura original:

1. **Las `policies` de dominio NO son puertos hexagonales**, aunque usan el
   mismo patron interfaz+implementacion (Strategy) que los puertos out.
   `SlotAssignmentPolicy`, `ParkingPolicy`, `ReservationPolicy` y
   `PricingPolicy` son reglas de negocio intercambiables *dentro* del
   nucleo: nunca cruzan hacia infraestructura. Por eso viven en
   `core/domain/policies/` con su propio `policy-tokens.ts`, separadas de
   `core/ports/out/tokens.ts`.

2. **`payment-method.port.ts` si es un puerto out**, aunque en el codigo
   original vivia junto a las policies (`domain/policies/payment-method.port.ts`).
   A diferencia de las policies de arriba, `PaymentMethod` (el router que
   delega a efectivo/tarjeta/Yape/Plin) llama a sistemas de pago externos
   reales. Cruza la frontera, por lo tanto es `core/ports/out/payment-method.port.ts`.

3. **El notificador de tiempo real es un puerto OUT, no IN**, a pesar de que
   la tecnologia (WebSocket) suena como algo que "recibe" conexiones. La
   direccion de un puerto la define el flujo de control: los casos de uso
   (`RegisterEntryUseCase`, `CreateReservationUseCase`, etc.) **llaman** a
   `RealtimeNotifierPort.notifyXxx(...)` para avisar hacia afuera. Es el
   nucleo pidiendole algo al exterior, igual que le pide algo a la base de
   datos. Por eso `realtime-notifier.port.ts` esta en `ports/out/` y su
   adaptador en `adapters/out/realtime/`.

   El mismo archivo tecnico de WebSocket (`events.gateway.ts`) si tiene una
   mitad "in": autentica el socket al conectar y gestiona las salas
   (`join:branch` / `leave:branch`), que son mensajes que **llegan** desde
   el cliente. Por eso el gateway vive en `adapters/in/websocket/` mientras
   que el adaptador que implementa el puerto de notificacion vive en
   `adapters/out/realtime/`, aunque ambos usan el mismo socket.io por
   debajo.

4. **El scheduler es un adaptador "in"**, igual que un controller HTTP.
   `ReservationExpirationScheduler` no expone HTTP, pero cumple exactamente
   el mismo rol: algo externo (el cron de `@nestjs/schedule`) dispara al
   nucleo a traves del puerto `EXPIRE_OVERDUE_RESERVATIONS`. El mismo puerto
   lo usa tambien `AdminController` (endpoint `POST /admin/reservations/expire-now`
   para forzar el barrido en la demo en vivo) — dos adaptadores "in"
   distintos comparten un solo puerto "in".

5. **`domain/ports/tokens.ts` se dividio en dos**: mezclaba simbolos de
   repositorios (puertos out reales) con simbolos de policies (Strategy
   interno). Ahora `core/ports/out/tokens.ts` tiene solo los primeros (y se
   fusiono con los tokens que antes vivian en `application/ports/tokens.ts`:
   `CLOCK`, `QR_CODE`, `TOKEN_SERVICE`, `PASSWORD_HASHER`,
   `REALTIME_NOTIFIER`), y `core/domain/policies/policy-tokens.ts` tiene los
   segundos.

6. **El publicador de notificaciones (Kafka) es un puerto OUT**, por el
   mismo razonamiento que el notificador de tiempo real (punto 3): es el
   nucleo (`CreateReservationUseCase`) quien **llama** a
   `NotificationPublisherPort.publishReservationConfirmation(...)` para
   avisar hacia afuera que hay una reserva confirmada. El nucleo no sabe
   que existe Kafka, ni que hay un topico, ni que un servicio externo de
   notificaciones va a leer ese mensaje y mandar un correo — solo conoce la
   interfaz `core/ports/out/notification-publisher.port.ts`. La
   implementacion concreta (`adapters/out/messaging/kafka-notification-publisher.adapter.ts`)
   vive detras de esa interfaz, igual que Prisma vive detras de
   `*.repository.port.ts`. Publicar el correo de confirmacion es un efecto
   secundario, no una invariante de negocio: si Kafka esta caido, el
   adaptador loguea el error y no lanza, para no poder tumbar la
   confirmacion de la reserva (mismo criterio de resiliencia que ya se
   aplicaba en `RealtimeNotifierAdapter`).

7. **La cola de reservas (RabbitMQ) produce un puerto de cada lado**, y esa
   simetria es la mejor ilustracion de la regla "la direccion la define
   quien llama a quien":

   - `ReservationRequestQueuePort` es **out**: `RequestReservationUseCase`
     **llama** a la cola para depositar la solicitud. El nucleo no sabe que
     hay un exchange topic ni una routing key.
   - `ProcessReservationRequestPort` es **in**: el consumidor
     (`adapters/in/messaging/reservation-request.consumer.ts`) **llama** al
     nucleo cuando el broker le entrega un mensaje. Es exactamente el mismo
     rol que el scheduler del punto 4 o que un controller HTTP: algo de
     afuera dispara un caso de uso. Que la tecnologia sea la misma
     (RabbitMQ) en los dos casos es irrelevante para la clasificacion.

   Los dos brokers conviven porque resuelven problemas distintos, no porque
   uno sobre: **Kafka** es el bus de eventos de salida (el correo de
   confirmacion, que puede tener N consumidores independientes leyendo el
   mismo topico), **RabbitMQ** es la cola de trabajo (una solicitud, un
   worker que la procesa, ack o DLQ). Por eso el criterio de resiliencia
   tambien es distinto: el adaptador de Kafka loguea y sigue (efecto
   secundario), mientras que el de RabbitMQ **lanza**, y
   `RequestReservationUseCase` lo traduce a `ReservationQueueUnavailableError`
   (`503`). Si no se pudo encolar, la reserva no va a existir nunca, y eso el
   usuario tiene que saberlo en la misma respuesta HTTP.

8. **El mismo puerto out, dos adaptadores segun el proceso.** Este es el
   beneficio de hexagonal que se puede *demostrar*, no solo argumentar.

   `CreateReservationUseCase` ahora corre en el worker, un proceso sin
   socket.io (el gateway vive en el API). El caso de uso inyecta
   `REALTIME_NOTIFIER` y lo sigue llamando igual, pero el ensamblado le
   entrega otro adaptador:

   | Proceso | Modulo | Implementacion de `RealtimeNotifierPort` |
   |---|---|---|
   | API (`main.ts`) | `RealtimeModule` | `RealtimeNotifierAdapter` -> emite por socket.io |
   | Worker (`worker-main.ts`) | `WorkerModule` | `RabbitRealtimeRelayAdapter` -> reenvia por un exchange fanout |

   El API consume ese fanout con `RealtimeRelayConsumer` (cola exclusiva por
   instancia) y vuelve a invocar el mismo metodo sobre el adaptador de
   socket.io, de modo que el navegador recibe los eventos de siempre. Cambio
   la topologia de despliegue de mono-proceso a dos procesos, y **el nucleo
   no se entero**: cero lineas modificadas en `create-reservation.use-case.ts`.

## 5. Ejemplo de flujo completo

`POST /reservations` (crear una reserva). Son dos mitades en dos procesos,
unidas por la cola.

**Proceso API — encolar y responder 202:**

```
adapters/in/http/controllers/reservations.controller.ts   (adaptador driving)
  -> @Inject(REQUEST_RESERVATION) RequestReservationPort    (puerto in)
    -> core/application/use-cases/.../request-reservation.use-case.ts (nucleo)
      -> @Inject(RESERVATION_REQUEST_QUEUE) ReservationRequestQueuePort (puerto out)
        -> adapters/out/messaging/rabbitmq-reservation-queue.adapter.ts (adaptador driven)
          -> exchange "reservations" / rk "reservation.requested"
      <- 202 { requestId }
```

**Proceso worker — procesar y devolver el desenlace:**

```
cola RabbitMQ "reservations.requests"
  -> adapters/in/messaging/reservation-request.consumer.ts  (adaptador driving)
    -> @Inject(PROCESS_RESERVATION_REQUEST) ProcessReservationRequestPort (puerto in)
      -> core/application/use-cases/.../process-reservation-request.use-case.ts (nucleo)
        -> @Inject(CREATE_RESERVATION) CreateReservationPort  (puerto in, reusado tal cual)
          -> core/application/use-cases/.../create-reservation.use-case.ts (nucleo, SIN CAMBIOS)
            -> @Inject(RESERVATION_POLICY) ReservationPolicy       (regla interna, no es puerto)
            -> @Inject(SLOT_ASSIGNMENT_POLICY) SlotAssignmentPolicy (regla interna, no es puerto)
            -> @Inject(RESERVATION_REPOSITORY) ReservationRepositoryPort (puerto out)
              -> adapters/out/persistence/prisma/repositories/prisma-reservation.repository.ts
            -> @Inject(REALTIME_NOTIFIER) RealtimeNotifierPort      (puerto out)
              -> adapters/out/messaging/rabbit-realtime-relay.adapter.ts  (en el worker)
                -> exchange fanout "realtime.events"
                  -> adapters/in/messaging/realtime-relay.consumer.ts (de vuelta en el API)
                    -> adapters/out/realtime/realtime-notifier.adapter.ts -> socket.io -> navegador
            -> @Inject(NOTIFICATION_PUBLISHER) NotificationPublisherPort (puerto out)
              -> adapters/out/messaging/kafka-notification-publisher.adapter.ts
                -> topico Kafka "notifications.email.confirmation" -> servicio externo -> correo
        -> ack (procesada o rechazada por negocio) / nack -> DLQ (fallo de infraestructura)
```

Ni una linea de `create-reservation.use-case.ts` sabe que existe Express,
Prisma, Socket.IO, Kafka o RabbitMQ — ni siquiera sabe que ahora corre en
otro proceso, disparado por un mensaje en vez de por un request HTTP. Eso es
lo que hexagonal (y onion) buscan garantizar.

## 6. Que se mantuvo igual

- **Cero cambios de comportamiento.** El refactor es puramente estructural:
  mover archivos (`git mv`, preserva historial) + reescribir imports +
  agregar las 25 interfaces de puerto "in". Los 45 tests unitarios
  existentes pasan sin modificar su logica, solo sus rutas de import.
- **Prisma, JWT, HMAC QR, WebSocket, scheduler**: mismas librerias, mismos
  adaptadores, solo reubicados segun direccion (in/out) en vez de segun
  tecnologia.
- El build de Nest sigue generando `dist/src/bootstrap/main.js`
  (`nest-cli.json` -> `entryFile: "bootstrap/main"`); `Dockerfile`,
  `docker-compose.yml` y `package.json#start:prod` se actualizaron a esa
  ruta.
