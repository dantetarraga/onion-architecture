# Anatomía de la cola de reservas

Qué hace y cómo funciona cada uno de los 41 archivos del commit que convirtió la creación de
reservas en un flujo asíncrono sobre RabbitMQ, ordenados por el camino que recorre un mensaje.

| | |
|---|---|
| Commit | `f603cdb` |
| Rama | `feat/rabbitmq-reservas` |
| Alcance | 41 archivos · +1526 / −76 líneas · 19 nuevos, 22 modificados |

## El camino de una solicitud

```
API      POST /reservations ──> RequestReservationUseCase ──> exchange "reservations"
                                                              (rk reservation.requested)
         <── 202 { requestId }

                                        │
                                        ▼
                            cola "reservations.requests"
                                  (durable, DLX)
                                        │
                                        ▼
WORKER   ReservationRequestConsumer ──> ProcessReservationRequestUseCase
         (prefetch 1)                        │
                                             ▼
                                   CreateReservationUseCase   ← sin cambios
                                        │        │
                       Postgres  <──────┘        └──────>  Kafka (correo)
                                             │
                                             ▼
                                 exchange fanout "realtime.events"
                                             │
API                              RealtimeRelayConsumer ──> socket.io ──> navegador
                                             (evento reservation.request.resolved)
```

**La idea que ordena todo el commit:** el mensaje que entra a la cola lleva la *intención* de
reservar, no la reserva. Cuando el API publica todavía no se eligió cochera, no se calculó el
vencimiento y no se evaluó ninguna política — eso ocurre después, en el worker.

Por eso hay dos casos de uso nuevos en vez de uno: `RequestReservation` encola,
`ProcessReservationRequest` desencola. Y por eso `CreateReservationUseCase` no cambió ni una línea:
sigue haciendo exactamente lo mismo, solo que ahora lo dispara un mensaje en lugar de un request
HTTP.

---

## 1. Puertos del núcleo

Los contratos. Nada aquí sabe que existe RabbitMQ: solo declaran qué necesita el núcleo del exterior
(`out`) y qué le puede pedir el exterior al núcleo (`in`).

### `core/ports/out/reservation-request-queue.port.ts` — nuevo, +34

**Sirve para** declarar el contrato de la cola y, sobre todo, la forma exacta del mensaje que viaja
por ella (`ReservationRequestMessage`).

**Cómo funciona:** una sola operación, `enqueue(message)`. El mensaje tiene seis campos:
`requestId`, `userId`, `branchId`, `slotType?`, `startAt?` y `requestedAt`. Los dos opcionales
desaparecen del JSON cuando no se eligieron, que es por qué en la UI de RabbitMQ a veces se ven solo
cuatro campos.

### `core/ports/in/reservations/request-reservation.port.ts` — nuevo, +8

**Sirve para** ser el contrato que inyecta el controller HTTP, en lugar de la clase concreta del
caso de uso.

**Cómo funciona:** reexporta los tipos de entrada y salida del caso de uso y declara `execute()`. Es
el mismo patrón de los otros 25 puertos `in` del proyecto.

### `core/ports/in/reservations/process-reservation-request.port.ts` — nuevo, +5

**Sirve para** ser el contrato que inyecta el consumidor de la cola.

**Cómo funciona:** recibe un `ReservationRequestMessage` y devuelve `void`. Que sea un puerto *in*
es deliberado: el consumidor **llama** al núcleo, igual que un controller. La tecnología es RabbitMQ
en los dos lados, pero la dirección la define quién llama a quién.

### `core/ports/out/realtime-notifier.port.ts` — modificado, +23

**Sirve para** añadir el noveno método al puerto de tiempo real,
`notifyReservationRequestResolved()`, que es cómo el desenlace vuelve al navegador.

**Cómo funciona:** el payload lleva `requestId` (para correlacionar con el 202), `userId` (para
saber a qué sala emitir) y un `status` de tres valores: `CREATED` con la reserva,
`SUGGEST_OTHER_BRANCH` con la sucursal alternativa, o `REJECTED` con el código de error de dominio.

### `core/ports/in/tokens.ts` — modificado, +4

**Sirve para** registrar los símbolos de inyección `REQUEST_RESERVATION` y
`PROCESS_RESERVATION_REQUEST`.

**Cómo funciona:** `CREATE_RESERVATION` sigue existiendo y ahora lo consume el worker en vez del
controller. Ese detalle es el que hace que el caso de uso viejo se reutilice sin tocarlo.

### `core/ports/out/tokens.ts` — modificado, +1

**Sirve para** registrar `RESERVATION_REQUEST_QUEUE`, el símbolo que resuelve al adaptador de
RabbitMQ.

---

## 2. Casos de uso y error de dominio

La lógica nueva, partida en dos mitades que corren en procesos distintos.

### `core/application/use-cases/reservations/request-reservation.use-case.ts` — nuevo, +60

**Sirve para** la mitad del API: encolar la solicitud y devolver un identificador de seguimiento.

**Cómo funciona:** genera el `requestId` con `randomUUID()`, sella la hora con `ClockPort`, llama a
`enqueue()` y devuelve `{ requestId, status: 'QUEUED' }`. No decide *nada* de negocio — ni
políticas, ni cocheras, ni base de datos.

**Detalle clave:** si `enqueue` falla, lanza `ReservationQueueUnavailableError`. Es el criterio
opuesto al del publisher de Kafka, y a propósito: sin cola la reserva no va a existir nunca, así que
el usuario tiene que enterarse en la misma respuesta HTTP.

### `core/application/use-cases/reservations/process-reservation-request.use-case.ts` — nuevo, +91

**Sirve para** la mitad del worker: ejecutar la reserva y clasificar el desenlace.

**Cómo funciona:** inyecta `CREATE_RESERVATION` y lo invoca con los datos del mensaje. Mapea los dos
resultados posibles (`CREATED` / `SUGGEST_OTHER_BRANCH`) y captura los errores.

**Detalle clave:** aquí vive la decisión de si un mensaje se reintenta. Un `DomainError`
(`RESERVATION_ALREADY_ACTIVE`, `NO_AVAILABILITY`) es una *respuesta*, no un fallo: se notifica como
`REJECTED` y se retorna normal para que el consumidor haga `ack`, porque reintentarlo daría lo mismo
para siempre. Cualquier otro error se relanza para que el mensaje termine en la DLQ.

### `core/domain/errors/reservation-queue-unavailable.error.ts` — nuevo, +11

**Sirve para** representar "el broker no aceptó el mensaje" como un error de dominio y no como un
500 genérico.

**Cómo funciona:** extiende `DomainError` con el código `RESERVATION_QUEUE_UNAVAILABLE`, siguiendo
el mismo patrón que `NoAvailabilityError`.

---

## 3. Adaptadores de salida (RabbitMQ)

Aquí es donde aparece `amqplib` por primera vez. Todo lo de arriba se compila y se testea sin que
exista RabbitMQ.

### `adapters/out/messaging/rabbitmq.topology.ts` — nuevo, +61

**Sirve para** declarar exchanges, colas y bindings — el plano de lo que se ve en la UI de gestión.

**Cómo funciona:** `assertTopology()` es idempotente y la ejecutan **los dos procesos** al conectar
y después de cada reconexión, así que ninguno depende de que el otro arranque primero. Declara:

```
reservations          topic    rk reservation.requested
  └─ reservations.requests      durable, con DLX
reservations.dlx      topic
  └─ reservations.dlq           durable, binding "#"
realtime.events       fanout   canal de vuelta worker → API
```

Los nombres salen de variables de entorno con valores por defecto, así que se puede aislar un
ambiente sin recompilar.

### `adapters/out/messaging/rabbitmq.connection.ts` — nuevo, +157

**Sirve para** ser la única conexión AMQP, compartida por todo lo que publica y todo lo que consume,
en los dos procesos.

**Cómo funciona:** abre un canal en modo *confirm*, para que un `publish` pueda esperar el ack del
broker — necesario porque encolar es crítico. El arranque **no bloquea**: si el broker no está
listo, la app levanta igual y reintenta cada 3 s en segundo plano.

**Detalle clave:** el método `onReady(handler)`. Los consumidores no abren la conexión, se apuntan a
una lista; cuando hay canal, se ejecutan todos — y se vuelven a ejecutar **después de cada
reconexión**, porque un canal cerrado se lleva sus `consume` consigo. Sin eso, tras reiniciar el
broker el worker quedaría vivo pero sordo. La URL se enmascara antes de loguearla, porque lleva
credenciales.

### `adapters/out/messaging/rabbitmq-reservation-queue.adapter.ts` — nuevo, +46

**Sirve para** implementar `ReservationRequestQueuePort` publicando en el exchange.

**Cómo funciona:** serializa el mensaje y lo publica con `persistent: true` (sobrevive a un reinicio
del broker), `messageId` = el `requestId` y `contentType: application/json` — los tres campos que se
ven en el panel *Properties* de la UI. Envuelve el callback del canal confirm en una promesa, así
que el `await` no vuelve hasta que el broker confirmó.

**Detalle clave:** ante un fallo, loguea y **relanza**. Es el contraste explícito con
`KafkaNotificationPublisherAdapter`, que loguea y sigue.

### `adapters/out/messaging/rabbit-realtime-relay.adapter.ts` — nuevo, +109

**Sirve para** resolver el problema de que el worker no tiene sockets: socket.io vive en el API, con
los navegadores conectados a *ese* proceso.

**Cómo funciona:** implementa `RealtimeNotifierPort` entero, pero cada método, en vez de emitir,
empaqueta `{ method, args }` y lo publica en el fanout `realtime.events`. Del otro lado se vuelve a
invocar el mismo método sobre el adaptador real.

**Detalle clave:** este archivo es el argumento demostrable de la arquitectura hexagonal en el
proyecto. El mismo token `REALTIME_NOTIFIER` se resuelve a socket.io en el API y a este relay en el
worker; `CreateReservationUseCase` llama `notifyReservationCreated(...)` igual que siempre y no se
entera de que cambió la topología de despliegue.

---

## 4. Consumidores (adaptadores de entrada)

Carpeta nueva `adapters/in/messaging/`. Cumplen el mismo rol que un controller HTTP o el scheduler:
algo externo dispara el núcleo.

### `adapters/in/messaging/reservation-request.consumer.ts` — nuevo, +99

**Sirve para** consumir `reservations.requests` en el worker y decidir el ack de cada mensaje.

**Cómo funciona:** en `onModuleInit` se registra vía `onReady`; cuando hay canal aplica `prefetch` y
arranca el `consume`. Por cada mensaje: parsea el JSON, **revive las fechas** a `Date` (el JSON las
aplana a string y el núcleo espera objetos), y llama al puerto.

**Detalle clave:** `prefetch(1)` hace que el broker no entregue el mensaje siguiente hasta ack-ear
el actual: las solicitudes se procesan de a una y dos usuarios no pueden pelear por la última
cochera. Es el argumento técnico de por qué la cola aporta algo real. Se ajusta con
`RABBITMQ_PREFETCH`. Un JSON ilegible va directo a la DLQ sin pasar por el núcleo.

### `adapters/in/messaging/realtime-relay.consumer.ts` — nuevo, +70

**Sirve para** recibir en el API los eventos que el worker no pudo emitir, y reemitirlos por
socket.io.

**Cómo funciona:** declara una cola **exclusiva y auto-delete** con nombre generado por el broker
(esos `amq.gen-…` que se ven en la UI), la enlaza al fanout y consume con `noAck`. Al recibir, saca
`method` y `args` del sobre y aplica el método sobre el `RealtimeNotifierAdapter` real.

**Detalle clave:** es exclusiva por instancia a propósito: si se escala el API a varias réplicas, el
fanout le entrega una copia a cada una y cada una atiende a sus propios navegadores. Y si el API se
apaga, su cola desaparece sola en vez de acumular eventos que ya nadie va a ver.

---

## 5. Bordes que ya existían

Cuatro archivos previos, con cambios pequeños y muy localizados.

### `adapters/in/http/controllers/reservations.controller.ts` — modificado, +31

**Sirve para** dejar de crear la reserva y pasar a encolarla.

**Cómo funciona:** `create` y `confirmSuggestion` ahora inyectan `REQUEST_RESERVATION` en vez de
`CREATE_RESERVATION`, y llevan `@HttpCode(202)`. El resto de endpoints (`list`, `getById`, `cancel`)
sigue siendo síncrono e intacto.

### `adapters/in/http/filters/domain-exception.filter.ts` — modificado, +1

**Sirve para** traducir el error nuevo al código HTTP correcto.

**Cómo funciona:** una línea en el mapa `STATUS_BY_CODE`: `RESERVATION_QUEUE_UNAVAILABLE → 503`. Es
lo que hace que `docker compose stop rabbitmq` devuelva un 503 con mensaje legible.

### `adapters/in/websocket/events.gateway.ts` — modificado, +3

**Sirve para** poder dirigirle a un usuario concreto el resultado de *su* solicitud.

**Cómo funciona:** al autenticar el socket ahora también hace `client.join('user:' + payload.sub)`.
Antes solo existían las salas `admin` y `branch:<id>`, y ninguna sirve para esto: el `requestId` le
interesa a una sola persona.

### `adapters/out/realtime/realtime-notifier.adapter.ts` — modificado, +12

**Sirve para** implementar el método nuevo del puerto emitiendo de verdad por socket.io.

**Cómo funciona:** emite `reservation.request.resolved` a la sala `user:<userId>` y también a
`admin`. Es el último salto: lo que recibe el navegador.

---

## 6. Ensamblado

El *composition root*: dónde se decide qué adaptador concreto responde a cada puerto. Aquí es donde
el mismo código se convierte en dos procesos distintos.

### `bootstrap/messaging.module.ts` — modificado, +22

**Sirve para** registrar los dos brokers, cada uno en su rol.

**Cómo funciona:** suma `RabbitMqConnection` y ata `RESERVATION_REQUEST_QUEUE` al adaptador de
RabbitMQ, junto al `NOTIFICATION_PUBLISHER` de Kafka que ya estaba. Sigue siendo `@Global()` y lo
importan los dos procesos.

### `bootstrap/reservations.module.ts` — modificado, +14

**Sirve para** registrar los dos casos de uso nuevos.

**Cómo funciona:** añade `RequestReservationUseCase` y `ProcessReservationRequestUseCase` con sus
tokens, y exporta `PROCESS_RESERVATION_REQUEST` para que el consumidor del worker lo pueda inyectar.
`CreateReservationUseCase` sigue registrado igual que antes.

### `bootstrap/realtime.module.ts` — modificado, +13

**Sirve para** sumar el consumidor del relay al proceso API.

**Cómo funciona:** añade `RealtimeRelayConsumer` a los providers. Como este módulo solo lo importa
el API, el worker nunca lo carga.

### `bootstrap/worker.module.ts` — nuevo, +48

**Sirve para** definir qué carga el worker — y sobre todo qué *no* carga.

**Cómo funciona:** importa Prisma, repositorios, políticas, core-infra, messaging y reservations.
Deja fuera dos cosas a propósito:

| Excluido | Por qué |
|---|---|
| `SchedulerModule` | El cron de expiración corre solo en el API. Con 3 workers escalados, el barrido se ejecutaría cuatro veces. |
| `RealtimeModule` | No hay sockets. En su lugar declara un módulo `@Global()` propio que ata `REALTIME_NOTIFIER` a `RabbitRealtimeRelayAdapter`. |

### `bootstrap/worker-main.ts` — nuevo, +19

**Sirve para** ser la segunda puerta de entrada de la misma imagen Docker.

**Cómo funciona:** usa `NestFactory.createApplicationContext()` en vez de `create()`: construye toda
la inyección de dependencias pero **no levanta servidor**. Sin puerto, sin Swagger, sin CORS. El
proceso queda vivo porque tiene un socket abierto contra RabbitMQ.

---

## 7. Infraestructura

Nada de esto es código de aplicación, pero sin ello el worker no existe como servicio.

### `docker-compose.yml` — modificado, +49

**Sirve para** sumar el broker y el worker al stack completo.

**Cómo funciona:** dos servicios nuevos. `rabbitmq` usa la imagen `3.13-management-alpine`, que trae
la UI web de gestión en el 15672 además del 5672 de AMQP, con *healthcheck* por
`rabbitmq-diagnostics`. `reservations-worker` reusa el mismo `build: ./backend` y solo cambia el
`command` a `node dist/src/bootstrap/worker-main.js` — misma imagen, otro entrypoint. Es lo que
permite `--scale reservations-worker=3`.

### `backend/docker-compose.dev.yml` — modificado, +17

**Sirve para** tener RabbitMQ disponible cuando se corre el backend en el host con
`npm run start:dev`.

**Cómo funciona:** mismo servicio, sin el worker: en modo desarrollo el worker se levanta en otra
terminal con `npm run start:worker:dev`.

### `.env.example` — modificado, +19

**Sirve para** documentar las nueve variables nuevas.

**Cómo funciona:** `RABBITMQ_URL` apunta a `localhost` para desarrollo y el compose la sobreescribe
a `rabbitmq:5672`, exactamente el mismo truco que ya usaba Kafka. `RABBITMQ_PREFETCH` es la palanca
para pasar de procesamiento serializado a paralelo.

### `.gitignore` — nuevo, +2

**Sirve para** evitar que se commitee el `.env` de la raíz, que lleva `JWT_SECRET` y contraseñas.

**Cómo funciona:** no existía ninguno en la raíz — `backend/.gitignore` ya cubría el suyo, pero el
de arriba quedaba expuesto.

### `backend/package.json` — modificado, +4

**Sirve para** sumar `amqplib` y los scripts del worker.

**Cómo funciona:** `start:worker` para producción y `start:worker:dev`, que usa
`--entryFile bootstrap/worker-main` para arrancar el otro entrypoint en modo watch.

### `backend/package-lock.json` — modificado, +47

**Sirve para** fijar `amqplib` y sus dependencias. Generado por npm, no se edita a mano.

---

## 8. Frontend

El cambio obligatorio: la respuesta HTTP ya no trae la reserva, así que la UI tiene que esperar el
evento.

### `src/types/entities.ts` — modificado, +34 / −16

**Sirve para** reflejar la forma nueva de las respuestas.

**Cómo funciona:** añade `ReservationRequestAccepted` (el 202) y `ReservationRequestResolved` (el
evento WebSocket). Elimina `CreateReservationResult` y sus dos variantes, que describían la
respuesta síncrona que ya no existe.

### `src/api/reservations.api.ts` — modificado, +7

**Sirve para** ajustar los tipos de retorno de `create` y `confirmSuggestion`.

**Cómo funciona:** las URLs y los cuerpos no cambian; lo único distinto es que ahora devuelven
`{ requestId, status }`.

### `src/pages/branches/ReservationModal.tsx` — modificado, +97 / −24

**Sirve para** convertir el modal de "espero la respuesta HTTP" a "espero el evento".

**Cómo funciona:** guarda el `requestId` del 202 en estado, muestra "Solicitud en cola, procesando…"
y se suscribe con el hook que ya existía, `useSocketEvent`, filtrando por ese `requestId`. Según el
`status` navega a "Mi reserva", muestra la sucursal sugerida (esa rama de la UI quedó intacta) o
notifica el rechazo.

**Detalle clave:** un temporizador de 20 s libera el botón si no llega nada — es el aviso que
aparece cuando se apaga el worker a propósito. La solicitud no se cancela: sigue viva en la cola.

---

## 9. Tests

11 pruebas nuevas; 56 en total pasando. Los dos casos de uso se testean con mocks manuales, sin
levantar RabbitMQ.

### `…/reservations/request-reservation.use-case.spec.ts` — nuevo, +68

**Cubre** que encola con los datos correctos y devuelve el `requestId`; que propaga `startAt` en
reservas programadas; que cada solicitud recibe un id distinto; y que un fallo de la cola se
convierte en `ReservationQueueUnavailableError`.

### `…/reservations/process-reservation-request.use-case.spec.ts` — nuevo, +143

**Cubre** los tres desenlaces y, lo más importante, la frontera del reintento: un `DomainError` se
resuelve como `REJECTED` sin relanzar (el mensaje se ack-ea), y un error de infraestructura sí se
relanza (el mensaje va a la DLQ). Ese test es el que impide que alguien "arregle" el catch y rompa
la semántica de la cola.

### `create-reservation` · `register-exit` · `register-payment` `.use-case.spec.ts` — modificados, +1 cada uno

**Cambio:** una línea en cada uno. El mock de `RealtimeNotifierPort` necesita el método nuevo
(`notifyReservationRequestResolved: jest.fn()`). La lógica de las pruebas no se tocó.

---

## 10. Documentación

### `docs/arquitectura-hexagonal.md` — modificado, +106

**Sirve para** justificar las decisiones de clasificación, que es lo que suele preguntar un jurado.

**Cómo funciona:** dos puntos nuevos en la sección 4: por qué la cola produce un puerto *out* y uno
*in* a la vez, y la tabla del mismo puerto con dos adaptadores según el proceso. La sección 5 pasa a
mostrar el flujo partido en las dos mitades.

### `docs/demo-runbook.md` — modificado, +35

**Sirve para** el guion paso a paso de la demo en vivo.

**Cómo funciona:** los cinco pasos para mostrar el mensaje detenido en la cola (empezando por apagar
el worker, si no se consume en milisegundos y no se ve nada), más los casos de borde: rechazo de
negocio, broker caído, DLQ, competing consumers y por qué `prefetch=1`.

### `README.md` — modificado, +29

**Sirve para** que quien clone el repo sepa que hay un segundo proceso obligatorio.

**Cómo funciona:** añade la línea de mensajería al stack, el `start:worker:dev` al quick start y las
URLs de las dos UIs de inspección.

---

## Los tres archivos que concentran las decisiones

Si hay poco tiempo para revisar, son estos:

1. **`rabbit-realtime-relay.adapter.ts`** — el argumento demostrable de hexagonal: mismo token
   `REALTIME_NOTIFIER`, socket.io en el API y relay por fanout en el worker, y
   `CreateReservationUseCase` sin enterarse.
2. **`process-reservation-request.use-case.ts`** — la frontera entre "rechazo de negocio" (ack, no
   se reintenta) y "fallo de infraestructura" (nack → DLQ). Es la decisión más discutible del commit
   y tiene test propio.
3. **`rabbitmq.connection.ts`** — el `onReady` que re-suscribe consumidores tras cada reconexión.
   Sin eso el worker sobrevive a un reinicio del broker pero queda sordo.
