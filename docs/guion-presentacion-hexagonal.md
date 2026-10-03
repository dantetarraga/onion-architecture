# Guion: Refactor de Onion a Arquitectura Hexagonal (12-15 min)

Publico: profesor + companeros que ya conocen el proyecto SIGE y ya vieron
la version en Onion Architecture. No hace falta re-explicar el dominio de
negocio (sucursales, reservas, estacionamiento, pagos) — vamos directo a la
arquitectura.

Convenciones de este guion:
- Texto normal = lo que dices.
- `[PANTALLA: ...]` = que archivo/carpeta mostrar en el editor en ese momento.
- `> nota` = tip para ti, no lo dices en voz alta.

---

## 0. Gancho de apertura (30 seg)

> di esto casi textual, es el gancho

"Ya vimos como estructuramos el backend con Onion Architecture: dominio en
el centro, capas alrededor. Ahora vamos a tomar el **mismo dominio, las
mismas reglas de negocio, los mismos tests** — y vamos a reorganizarlo con
otro patron muy conocido en la industria: **Arquitectura Hexagonal**, tambien
llamada Ports & Adapters. La pregunta que vamos a responder es: ¿que cambia
realmente, y que NO cambia?"

`[PANTALLA: terminal, mostrar `git log --oneline -3` en la rama refactor/hexagonal-architecture]`

---

## 1. El punto de partida: misma regla, distinta organizacion (1.5 min)

"Onion y Hexagonal comparten la regla mas importante: **el codigo de negocio
no puede depender de frameworks ni de infraestructura**. Eso no cambio. Lo
que cambia es *como organizamos las carpetas* para expresar esa regla.

- En Onion pensamos en **anillos**: mientras mas adentro, mas puro. Domain
  al centro, Application alrededor, Infrastructure y Presentation afuera.
- En Hexagonal no hay anillos. Hay **un solo limite**: adentro esta el
  *nucleo* — dominio y casos de uso —, y afuera todo es un *adaptador*
  conectado a un *puerto*. Los puertos no se clasifican por capa, se
  clasifican por **direccion**: quien llama a quien."

`[PANTALLA: docs/arquitectura-hexagonal.md, seccion 1]`

"Esa es la idea que vamos a ver en el codigo: no 'que tan adentro esta', sino
'¿esto entra al nucleo, o el nucleo lo llama hacia afuera?'"

---

## 2. Recorrido de la estructura de carpetas (2 min)

`[PANTALLA: explorador de archivos, backend/src/]`

"Aca esta el resultado. Cuatro carpetas de primer nivel:

```
core/        <- el hexagono: domain + application + ports (in y out)
adapters/    <- todo lo externo, separado en in/ y out/
bootstrap/   <- modulos de NestJS, el 'pegamento' de inyeccion de dependencias
```

Adentro de `core/` esta lo que ya conociamos de Onion — `domain` con
entidades, `enums`, `errors`, `policies` — pero ahora tiene una carpeta
`ports/` con dos subcarpetas: `in/` y `out/`. Ahi esta el cambio de
vocabulario mas importante."

`[PANTALLA: core/ports/]`

"`ports/out/` es lo que el nucleo *necesita* del exterior: los repositorios,
el reloj, el firmador de QR, el JWT. Eso ya lo teniamos en Onion, solo que
repartido entre `domain/ports` y `application/ports`. Aca lo unificamos.

`ports/in/` es nuevo: son los puntos de entrada al nucleo, uno por cada caso
de uso. Antes, un controller inyectaba directamente la clase
`CreateReservationUseCase`. Ahora inyecta una interfaz,
`CreateReservationPort`. Vamos a ver por que en un momento."

`[PANTALLA: adapters/]`

"`adapters/` tiene la misma logica: `in/` es todo lo que **dispara** al
nucleo — los controllers HTTP, el scheduler que corre cada minuto, el
gateway de WebSocket. `out/` es todo lo que el nucleo **usa** — Prisma, JWT,
el HMAC de los QR, los adaptadores de pago, el notificador de WebSocket."

---

## 3. El concepto clave: la direccion la define quien llama a quien (2.5 min)

"Aca esta el punto que mas cuesta al principio, y por eso les traigo un
ejemplo que sorprende: **el notificador de WebSocket es un puerto OUT, no
IN**."

`[PANTALLA: core/ports/out/realtime-notifier.port.ts]`

"La tecnologia es WebSocket, que uno asociaria con 'algo que recibe
conexiones', o sea 'in'. Pero miren quien llama a quien:"

`[PANTALLA: core/application/use-cases/reservations/create-reservation.use-case.ts, buscar `this.notifier.notify`]`

"El caso de uso `CreateReservationUseCase` **llama** a
`notifier.notifyReservationCreated(...)`. El nucleo le esta pidiendo algo al
exterior — 'avisale a los clientes conectados' — exactamente igual que le
pide algo a la base de datos. Por eso es un puerto **out**.

Ahora, el archivo `events.gateway.ts` si tiene una mitad **in**: cuando un
cliente se conecta y manda `join:branch`, eso es un mensaje que **llega**
desde afuera hacia el nucleo... aunque en este caso ni siquiera llega a
tocar un caso de uso, solo gestiona la sala de sockets."

`[PANTALLA: adapters/in/websocket/events.gateway.ts vs adapters/out/realtime/realtime-notifier.adapter.ts]`

"Por eso separamos el mismo socket.io en dos archivos, en dos carpetas
distintas: uno es adaptador **in** (recibe conexiones), el otro es adaptador
**out** (empuja notificaciones). La regla para decidir 'in' o 'out' nunca es
la tecnologia — **es la direccion de la llamada.**"

> nota: si notas que se quedaron con cara de duda, repite la frase final
> una vez mas, despacio. Es el concepto que mas preguntas genera.

---

## 4. Flujo completo, con codigo real (3.5 min)

"Vamos a seguir una peticion completa: `POST /reservations`, crear una
reserva. Empezamos afuera del todo."

`[PANTALLA: adapters/in/http/controllers/reservations.controller.ts]`

"El controller ya no inyecta `CreateReservationUseCase` directamente. Mira
el constructor: inyecta `CREATE_RESERVATION`, un token, tipado como
`CreateReservationPort`, una interfaz."

```ts
constructor(
  @Inject(CREATE_RESERVATION) private readonly createReservation: CreateReservationPort,
  ...
) {}
```

"El controller no sabe — ni le importa — que clase concreta esta detras del
token. Solo conoce el contrato."

`[PANTALLA: core/ports/in/reservations/create-reservation.port.ts]`

"Y ese contrato es esta interfaz de tres lineas: recibe un
`CreateReservationInput`, devuelve un `CreateReservationResult`. Eso es
*todo* lo que el puerto in expone."

`[PANTALLA: core/application/use-cases/reservations/create-reservation.use-case.ts]`

"La implementacion es la misma clase que ya conociamos de Onion —
`CreateReservationUseCase` — pero ahora dice `implements CreateReservationPort`.
Adentro, nada cambio: sigue usando `ReservationPolicy` y
`SlotAssignmentPolicy` para las reglas de negocio, y sigue pidiendo cosas
por puerto **out**: el repositorio de reservas, el reloj, el notificador."

`[PANTALLA: bootstrap/reservations.module.ts]`

"¿Y quien conecta el token con la clase concreta? El modulo de NestJS, en
`bootstrap/`. Aca es donde vive el 'cableado':"

```ts
providers: [
  CreateReservationUseCase,
  { provide: CREATE_RESERVATION, useExisting: CreateReservationUseCase },
]
```

"`useExisting` le dice a Nest: 'el token `CREATE_RESERVATION` resuelve a la
misma instancia que ya cree de `CreateReservationUseCase`, no crees una
segunda'. Asi evitamos duplicar el objeto."

`[PANTALLA: core/ports/out/reservation.repository.port.ts -> adapters/out/persistence/prisma/repositories/prisma-reservation.repository.ts]`

"Y del otro lado, cuando el caso de uso pide el repositorio, lo que recibe
en tiempo de ejecucion es `PrismaReservationRepository`, el adaptador **out**
que implementa esa interfaz con Prisma."

"Resumen del viaje completo:

```
Controller (adaptador in)
  -> CreateReservationPort (puerto in)
    -> CreateReservationUseCase (nucleo)
      -> ReservationPolicy, SlotAssignmentPolicy (reglas internas, no son puertos)
      -> ReservationRepositoryPort (puerto out)
        -> PrismaReservationRepository (adaptador out)
      -> RealtimeNotifierPort (puerto out)
        -> RealtimeNotifierAdapter (adaptador out)
```

Ni una sola linea del caso de uso sabe que existe Express, Prisma o
Socket.IO. Eso es lo que ambas arquitecturas — Onion y Hexagonal — buscan
garantizar. Lo unico que cambio es el nombre y la agrupacion de las
carpetas."

---

## 5. Las decisiones que tuvimos que tomar (2 min)

"Hexagonal no siempre es mecanico: hubo un par de casos donde tuvimos que
decidir, y quiero mencionarlos porque seguro son las preguntas que nos van a
hacer."

`[PANTALLA: core/domain/policies/ vs core/ports/out/payment-method.port.ts]`

"**Primero**: las *policies* de dominio — `ParkingPolicy`, `PricingPolicy`,
`ReservationPolicy`, `SlotAssignmentPolicy` — usan interfaz + implementacion,
igual que un puerto. Pero decidimos que **no son puertos hexagonales**,
porque nunca cruzan hacia afuera: son reglas de negocio intercambiables
*dentro* del nucleo. Se quedan en `core/domain/policies/`.

En cambio, `PaymentMethod` — el que decide si cobrar con Yape, tarjeta,
efectivo — si llama a sistemas externos reales. Por eso ese si es un puerto
**out**, aunque en la version anterior estaba archivado junto a las
policies."

`[PANTALLA: adapters/in/scheduler/reservation-expiration.scheduler.ts]`

"**Segundo**: el scheduler — el cron que expira reservas vencidas cada
minuto — no tiene nada de HTTP, pero cumple el mismo rol que un controller:
algo externo (el reloj del sistema operativo, via `@nestjs/schedule`)
dispara al nucleo. Es un adaptador **in**, igual que
`AdminController.expireNow()`, que dispara el mismo puerto para la demo en
vivo."

> nota: si el tiempo aprieta, esta seccion se puede recortar a solo el
> ejemplo del notificador (ya visto en la seccion 3) y saltar directo al
> cierre.

---

## 6. Como comprobamos que no rompimos nada (1 min)

"La pregunta obligada: ¿como saben que el refactor no cambio el
comportamiento?

`[PANTALLA: terminal]`

```
npx tsc --noEmit     -> compila sin errores
npm test              -> 45 tests, 9 suites, todos pasan, sin tocar su logica
npm run build          -> genera dist/src/bootstrap/main.js
```

Y una prueba mas especifica de Hexagonal: compilamos el `AppModule` completo
con el modulo de testing de Nest, sin arrancar el servidor. Eso valida que
**los 25 tokens de puerto resuelven correctamente** — que no quedo ningun
`@Inject` apuntando a un token que nadie provee. Si algo del cableado
estuviera mal, esto habria fallado ahi, no en produccion."

---

## 7. Cierre (30 seg)

"En resumen: mismo dominio, mismas reglas de negocio, mismos tests — dos
formas distintas de organizar las carpetas alrededor de la misma regla de
dependencia. Onion piensa en anillos concentricos; Hexagonal piensa en
puertos con direccion: **in** cuando algo entra a activar al nucleo, **out**
cuando el nucleo pide algo hacia afuera. Esa sola pregunta — ¿quien llama a
quien? — es la que clasifica cada archivo del proyecto."

---

## Preguntas frecuentes (preparate para estas)

**¿Por que no dejaron el controller inyectando la clase directamente, como
antes? ¿No era mas simple?**
Si, es mas simple, y muchas implementaciones "pragmaticas" de hexagonal lo
hacen asi. Lo formalizamos con interfaces explicitas (`core/ports/in/`) a
proposito, con fines didacticos: para que se vea en el codigo, sin
ambiguedad, cual es el contrato que cruza la frontera del hexagono. El costo
es 25 archivos mas de puerto; el beneficio es que el controller queda
acoplado a un contrato, no a una clase concreta.

**¿Que gana el proyecto con este cambio? ¿No era suficiente con Onion?**
Nada cambia en produccion — es el mismo comportamiento. El valor es
didactico: mostrar que la regla de dependencia (que es lo que realmente
importa en arquitectura limpia) se puede expresar con vocabularios
distintos. Ademas, Hexagonal hace mas explicito algo que Onion deja
implicito: la distincion entre "algo que entra" y "algo que el nucleo pide
hacia afuera".

**¿`useExisting` en los modulos no es un poco de magia de NestJS?**
Es la forma que tiene Nest de decir "este token y esta clase apuntan a la
misma instancia, no crees dos objetos". Sin eso, tendriamos dos instancias
del mismo caso de uso — una accesible por su clase, otra por su token — lo
cual desperdicia memoria y podria causar bugs sutiles si alguna tuviera
estado.

**¿Como migraron 297 archivos sin romper nada?**
`git mv` preserva el historial en cada archivo movido. Despues corrimos un
script que reescribe automaticamente las rutas de import segun la nueva
ubicacion de cada archivo — no fue a mano uno por uno. Y en cada paso
grande volvimos a compilar y correr los tests antes de seguir.

**¿Las policies no deberian ser puertos tambien, ya que usan interfaz +
implementacion?**
Interfaz + implementacion (patron Strategy) no es lo mismo que "puerto
hexagonal". Un puerto hexagonal marca una frontera hacia el *exterior* del
sistema (base de datos, un servicio de pago, el reloj del sistema). Las
policies son reglas de negocio con implementacion intercambiable, pero
nunca salen del nucleo — por eso no calificamos.
