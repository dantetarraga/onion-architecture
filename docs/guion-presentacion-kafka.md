# Guion de exposición — `presentacion-kafka.pptx`

Duración objetivo: **8-10 min** + preguntas. 10 diapositivas, ritmo de
~45-60 seg por diapositiva de contenido, más tiempo en las slides 7 y 8
(la evidencia en vivo de kafka-ui).

Público: profesor + compañeros que ya conocen el proyecto SIGE y la
migración a Arquitectura Hexagonal. No hay que re-explicar el dominio de
negocio ni el patrón hexagonal en sí — vamos directo a la implementación de
Kafka.

Convenciones:
- Texto normal = lo que dices, casi textual.
- `> nota` = tip para ti, no se dice en voz alta.
- Antes de empezar: ten `http://localhost:8080` (kafka-ui) abierto en otra
  pestaña por si el jurado pide ver el topic en vivo además de la captura
  de la slide, y el stack corriendo (`docker compose up -d`).

---

## Slide 1 — Portada (20 seg)

"Vamos a mostrar una pieza específica del backend: cómo la confirmación de
una reserva se convierte en un correo, usando Kafka como bus de eventos.
No es todo el sistema de mensajería — eso lo completa un compañero con
RabbitMQ — es la mitad que nos tocó: **publicar el evento y consumirlo para
mandar el correo**."

> nota: pausa breve, es la única slide sin contenido técnico que explicar.

---

## Slide 2 — El problema (45 seg)

"Antes de tener esto, si quisiéramos mandar un correo de confirmación, la
opción obvia sería hacerlo en el mismo request que crea la reserva. El
problema es que eso acopla dos cosas que no tienen por qué depender una de
la otra: si el servidor de correo está lento o caído, ¿por qué debería
fallar o demorarse la reserva?

La solución es que el núcleo del backend no mande el correo — **publica un
evento** diciendo 'esta reserva quedó confirmada', y sigue. Kafka es el bus
de eventos de salida: quien quiera enterarse, se suscribe. El backend ni
siquiera sabe que existe un servicio de notificaciones."

`[PANTALLA: opcional, backend/src/core/application/use-cases/reservations/create-reservation.use-case.ts]`

---

## Slide 3 — Arquitectura (50 seg)

"Esto encaja en la arquitectura hexagonal como un puerto de salida más.
`NotificationPublisherPort` vive en `core/ports/out` — es una interfaz, el
núcleo la declara sin saber qué hay del otro lado.

Quien la implementa es `KafkaNotificationPublisherAdapter`, usando la
librería `kafkajs`. Es la única pieza de todo el sistema que sabe que existe
un broker de Kafka. El caso de uso, `CreateReservationUseCase`, solo llama
al puerto — si mañana cambiamos Kafka por SQS o por RabbitMQ, no se toca ni
una línea de lógica de negocio."

`[PANTALLA: core/ports/out/notification-publisher.port.ts]`

---

## Slide 4 — El contrato del evento (45 seg)

"Esto es lo que se publica: `ReservationConfirmationEvent`. Se dispara solo
cuando la reserva queda `CREATED` — nunca para una reserva rechazada o para
una sugerencia de otra sucursal.

Fíjense que lleva **todo** lo necesario para redactar el correo: el email y
nombre del usuario, el nombre y dirección de la sucursal, el slot, las
fechas. El consumidor no tiene que volver a llamar al backend para nada.

Y el `reservationId` no solo va en el cuerpo del evento — es también la
**key** del mensaje de Kafka, así que todos los eventos de una misma reserva
quedan garantizados en el mismo orden."

`[PANTALLA: la slide misma, es código]`

---

## Slide 5 — El productor: resiliencia (45 seg)

"La decisión de diseño más importante acá es que **Kafka nunca puede tumbar
una reserva**. El publish está envuelto en try/catch: si falla — broker
caído, lo que sea — se loguea como error y el flujo sigue normal. El
usuario nunca ve un 500 por culpa de Kafka.

Este mismo criterio ya se usaba en el proyecto para las notificaciones por
WebSocket — un efecto secundario nunca debe poder bloquear la operación
crítica, que es la reserva en sí."

---

## Slide 6 — Infraestructura (35 seg)

"Para la demo, Kafka corre en modo **KRaft** — sin Zookeeper, un solo
contenedor hace de broker y de controller a la vez, es la forma moderna de
levantarlo. Y para poder *ver* lo que pasa sin usar la terminal, agregamos
`kafka-ui`, una consola web en el puerto 8080. Eso es justo lo que vamos a
ver ahora."

`[PANTALLA: docker-compose.yml, servicios kafka y kafka-ui]`

---

## Slide 7 — En vivo: el tópico (40 seg)

"Esto es kafka-ui real, capturado durante nuestras pruebas. El tópico se
llama `notifications.email.confirmation` — una partición, factor de
replicación 1 porque es un entorno de demo con un solo broker.

En el momento de la captura tenía 5 mensajes — una por cada reserva que
confirmamos probando el flujo. Fíjense que son solo 3 KB en total: el
evento es chico a propósito, no es para mover archivos grandes, es una
notificación."

`[PANTALLA: si el jurado quiere, abrir localhost:8080 en vivo y mostrar el mismo topic]`

---

## Slide 8 — En vivo: un mensaje real (50 seg)

"Y esto es lo interesante: un mensaje expandido, tal cual lo entrega Kafka.
A la izquierda tienen el `Key` — es el `reservationId` — separado del
`Value`, que es el JSON completo del evento.

Este mensaje en particular es de una prueba real que hicimos: reserva
confirmada para `humberto.lizana@gmail.com`, con el nombre de la sucursal,
el slot, las fechas — todo lo que el correo necesita.

Y como bonus: `eventType` no solo va dentro del JSON, también viaja como
**header** del mensaje de Kafka. Eso significa que un consumidor podría
filtrar por tipo de evento sin tener que deserializar el value completo."

> nota: si preguntan por qué no hay Avro/Schema Registry — es JSON plano a
> propósito, para mantenerlo simple en este alcance del proyecto.

---

## Slide 9 — Validación end-to-end (50 seg)

"Y esto no se quedó en teoría — lo validamos de punta a punta contra
infraestructura real, no mocks. Cuatro pasos: se crea la reserva por la
API, el adaptador publica en Kafka — eso es lo que acaban de ver en
kafka-ui —, un servicio aparte, `notifications-service`, consume ese
tópico, y finalmente se probó contra un servidor SMTP real,
`mail.motoya.com.pe`. El correo salió sin errores de conexión ni de
autenticación.

`notifications-service` es justamente eso: un **módulo aislado**, con su
propio proceso y su propio Dockerfile — no comparte código con el backend,
solo el contrato del evento que ya vimos."

`[PANTALLA: notifications-service/ en el explorador, o docs/demo-runbook.md]`

---

## Slide 10 — Cierre (30 seg)

"En una línea: el núcleo confirma la reserva y publica un evento, Kafka lo
entrega, y un servicio aislado manda el correo. Nada de esto bloquea ni
acopla la creación de la reserva al envío.

Y para cerrar: esto convive con el trabajo de RabbitMQ que hizo el equipo
para la cola de solicitudes de reserva — son complementarios, no compiten.
RabbitMQ encola la *solicitud*, Kafka publica el *resultado*. Con eso
cerramos, quedo atento a preguntas."

---

## Preguntas esperables (por si acaso)

- **¿Por qué Kafka y no simplemente enviar el correo directo (síncrono)?**
  → Resiliencia y desacople: un SMTP lento no debe demorar el response de
  crear una reserva; el consumidor puede estar caído y el evento sigue en
  el tópico esperando.

- **¿Qué pasa si `notifications-service` está caído cuando se publica el
  evento?** → Kafka retiene el mensaje según su retention policy; cuando el
  consumidor vuelve, lo procesa. No se pierde (a diferencia de un fallo del
  productor, que si se loguea y se descarta — ver siguiente pregunta).

- **¿Y si Kafka mismo está caído al momento de publicar?** → Ahí sí se
  pierde el evento — el productor loguea el error y sigue, deliberadamente,
  para no bloquear la reserva. Es una limitación conocida: no hay outbox ni
  dead-letter en este alcance, se podría agregar como trabajo futuro.

- **¿Por qué JSON y no Avro/Protobuf con Schema Registry?** → Simplicidad
  para el alcance del curso; el trade-off es no tener versionado de schema
  fuerte, aceptable para un solo consumidor interno del equipo.
