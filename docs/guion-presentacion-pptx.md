# Guion de exposición — `presentacion-onion-a-hexagonal.pptx`

Duración objetivo: **12-15 min** + preguntas. 16 diapositivas, ritmo de
~45-55 seg por diapositiva de contenido, más tiempo en las slides 6, 7 y 8
(el núcleo técnico de la charla).

Público: profesor + compañeros que ya conocen el proyecto SIGE y ya vieron
la versión en Onion Architecture. No hay que re-explicar el dominio de
negocio (sucursales, reservas, estacionamiento, pagos) — vamos directo a la
arquitectura.

Convenciones:
- Texto normal = lo que dices, casi textual.
- `> nota` = tip para ti, no se dice en voz alta.
- Puedes tener abierto en otra ventana `docs/arquitectura-hexagonal.md` y el
  editor con el código, por si el jurado pide ver un archivo real además de
  la slide.

---

## Slide 1 — Portada (30 seg)

"Buenas [tardes/noches]. Vamos a hablar de un refactor que hicimos sobre el
Sistema Inteligente de Gestión de Estacionamientos: pasar el backend de
**Onion Architecture** a **Arquitectura Hexagonal**, también conocida como
Ports & Adapters. Se hizo en una rama aparte, `refactor/hexagonal-architecture`,
y tocó 201 archivos — pero, como van a ver, sin romper ni un solo test."

> nota: pausa breve aquí, es la única slide donde no hay contenido técnico
> que explicar — úsala para que se acomode el público.

---

## Slide 2 — ¿Qué cambia realmente, y qué no? (45 seg)

"Ya vimos cómo estructuramos el backend con Onion: dominio en el centro,
capas alrededor. Lo que hicimos ahora es tomar **el mismo dominio, las
mismas reglas de negocio, los mismos tests** — y reorganizarlo con otro
patrón muy conocido en la industria: Arquitectura Hexagonal, de Alistair
Cockburn.

La pregunta que vamos a responder en esta charla es la que está a la
derecha: **¿qué cambia realmente, y qué no?** Y el spoiler es este: la regla
de que el código de negocio no depende de frameworks ni infraestructura —
esa regla **no cambió**. Lo que cambia es cómo organizamos las carpetas
para expresarla."

---

## Slide 3 — Onion vs Hexagonal (1 min)

"Onion piensa en **anillos concéntricos**: mientras más adentro, más puro.
Domain al centro, Application alrededor, Infrastructure y Presentation
afuera de todo. Es la imagen de la izquierda.

Hexagonal, a la derecha, no tiene anillos. Tiene **un solo límite**: adentro
está el núcleo — dominio y casos de uso —, y afuera todo es un adaptador
conectado a un puerto. La diferencia clave es que los puertos **no se
clasifican por capa, se clasifican por dirección**: quién llama a quién.
Eso es lo que dice el 'IN' y el 'OUT' alrededor del hexágono."

> nota: si el tiempo aprieta, esta slide se puede resumir en 30 seg — es
> la más conceptual y la retoman implícitamente las siguientes.

---

## Slide 4 — Estructura de carpetas, antes y después (1 min)

"Aquí está el cambio concreto. Antes teníamos cuatro carpetas: `domain`,
`application`, `infrastructure`, `presentation` — los cuatro anillos.

Ahora tenemos tres carpetas de primer nivel. `core/` es el hexágono
completo: adentro sigue estando `domain` y `application`, tal cual estaban,
más una carpeta nueva, `ports/`, con dos subcarpetas: `in/` y `out/`.
`adapters/` es todo lo externo, también separado en `in/` y `out/`.
Y `bootstrap/` es el 'pegamento': los módulos de NestJS que hacen la
inyección de dependencias — el `main.ts` también vive ahí ahora."

---

## Slide 5 — Ports & adapters, in vs out (1 min)

"Para que quede claro qué va en cada carpeta:

`ports/in/` son los puntos de entrada al núcleo — 25 interfaces, una por
cada caso de uso. Esto es nuevo, en Onion no existía; antes un controller
inyectaba directamente la clase del caso de uso.

`ports/out/` es lo que el núcleo *necesita* del exterior: los repositorios,
el reloj, el firmador de QR, el JWT. Esto ya lo teníamos en Onion, solo que
repartido entre `domain/ports` y `application/ports` — aquí lo unificamos.

`adapters/in/` es todo lo que **dispara** al núcleo: los controllers HTTP,
el scheduler que corre cada minuto, el gateway de WebSocket.

`adapters/out/` es todo lo que el núcleo **usa**: Prisma, JWT, el HMAC de
los QR, los adaptadores de pago, el notificador de WebSocket."

---

## Slide 6 — El ejemplo que sorprende: el notificador WebSocket (2 min)

> nota: esta es la slide más importante de la charla — la que genera
> preguntas. Tómate tu tiempo, no la apures.

"Aquí está el punto que más cuesta al principio, y por eso traigo un
ejemplo que sorprende: **el notificador de WebSocket es un puerto OUT, no
IN.**

La tecnología es WebSocket, que uno asociaría con 'algo que recibe
conexiones', o sea 'in'. Pero miren quién llama a quién: el caso de uso
`CreateReservationUseCase` **llama** a
`notifier.notifyReservationCreated(...)`. El núcleo le está pidiendo algo al
exterior — 'avísale a los clientes conectados' — exactamente igual que le
pide algo a la base de datos. Por eso es un puerto **out**.

Ahora, el archivo `events.gateway.ts` sí tiene una mitad **in**: cuando un
cliente se conecta y manda `join:branch`, eso es un mensaje que **llega**
desde afuera hacia el núcleo — aunque en este caso ni siquiera llega a
tocar un caso de uso, solo gestiona la sala de sockets.

Por eso separamos el mismo socket.io en dos archivos, en dos carpetas
distintas: uno es adaptador **in** — recibe conexiones —, el otro es
adaptador **out** — empuja notificaciones. La regla para decidir 'in' o
'out' nunca es la tecnología — **es la dirección de la llamada.**"

> nota: si notas caras de duda, repite la frase final una vez más,
> despacio: "la dirección la define quién llama a quién, no la tecnología."

---

## Slide 7 — Flujo completo: POST /reservations (2 min)

"Vamos a seguir una petición completa de principio a fin: crear una
reserva.

Empieza en el **Controller**, que es un adaptador in. El controller llama
al **puerto in** `CreateReservationPort` — una interfaz de tres líneas.
Detrás de ese puerto está el **núcleo**: `CreateReservationUseCase`, la
misma clase que ya conocíamos de Onion, sin ningún cambio de lógica.

Adentro, el caso de uso coordina dos reglas internas — `ReservationPolicy`
y `SlotAssignmentPolicy` — que **no son puertos**, son reglas de negocio
que nunca salen del núcleo, ya lo van a ver en la slide de decisiones.

Y para terminar la operación, el caso de uso pide dos cosas hacia afuera a
través de **puertos out**: el repositorio de reservas y el notificador en
tiempo real. Del otro lado de esos puertos están los **adaptadores out**:
Prisma para persistencia, el adaptador de WebSocket para la notificación.

El mensaje de abajo resume todo: ni una sola línea del caso de uso sabe que
existe Express, Prisma o Socket.IO."

---

## Slide 8 — Código real (1.5 min)

"Para que no quede en abstracto, este es el código real. Arriba a la
izquierda, el controller: ya no inyecta `CreateReservationUseCase`
directamente, inyecta un token `CREATE_RESERVATION` tipado como
`CreateReservationPort` — una interfaz. El controller no sabe, ni le
importa, qué clase concreta hay detrás del token.

Arriba a la derecha está esa interfaz: tres líneas, recibe un input,
devuelve un resultado. Eso es *todo* lo que el puerto in expone.

Abajo está el módulo de NestJS en `bootstrap/`, que es quien conecta el
token con la clase concreta. `useExisting` le dice a Nest: 'el token
`CREATE_RESERVATION` resuelve a la misma instancia que ya creé de
`CreateReservationUseCase`, no crees una segunda' — así evitamos duplicar
el objeto."

---

## Slide 9 — Decisión 1: las policies no son puertos (1 min)

"Hexagonal no siempre es mecánico, hubo un par de decisiones que quiero
mencionar porque seguro son las preguntas que nos van a hacer.

Primero: las *policies* de dominio — `ParkingPolicy`, `PricingPolicy`,
`ReservationPolicy`, `SlotAssignmentPolicy` — usan interfaz más
implementación, igual que un puerto. Pero decidimos que **no son puertos
hexagonales**, porque nunca cruzan hacia afuera: son reglas de negocio
intercambiables *dentro* del núcleo. Se quedan en `core/domain/policies/`.

En cambio, `PaymentMethod` — el que decide si cobrar con Yape, tarjeta o
efectivo — sí llama a sistemas externos reales. Por eso ese sí es un puerto
**out**, aunque en la versión anterior estaba archivado junto a las
policies."

---

## Slide 10 — Decisión 2: el scheduler es un adaptador IN (1 min)

"Segundo: el scheduler, el cron que expira reservas vencidas cada minuto,
no tiene nada de HTTP, pero cumple el mismo rol que un controller: algo
externo — el reloj del sistema operativo, vía `@nestjs/schedule` — dispara
al núcleo. Es un adaptador **in**, igual que `AdminController.expireNow()`,
que dispara el mismo puerto para poder hacer la demo en vivo sin esperar
los 20 minutos reales de tolerancia."

---

## Slide 11 — Cómo comprobamos que no rompimos nada (1 min)

"La pregunta obligada: ¿cómo saben que el refactor no cambió el
comportamiento?

`npx tsc --noEmit` compila sin errores. `npm test` corre 45 tests en 9
suites, todos pasan, sin tocar su lógica — solo sus rutas de import.
`npm run build` genera el `dist` correctamente.

Y una prueba más específica de Hexagonal: compilamos el `AppModule`
completo con el módulo de testing de Nest, sin arrancar el servidor. Eso
valida que **los 25 tokens de puerto resuelven correctamente** — que no
quedó ningún `@Inject` apuntando a un token que nadie provee. Si algo del
cableado estuviera mal, esto habría fallado ahí, no en producción."

---

## Slide 12 — 201 archivos migrados sin romper nada (40 seg)

"¿Y cómo migramos 201 archivos sin romper nada? `git mv` preserva el
historial de cada archivo movido. Después corrimos un script que reescribe
automáticamente las rutas de import según la nueva ubicación — no fue a
mano uno por uno. Y en cada paso grande volvimos a compilar y correr los
tests antes de seguir."

---

## Slide 13 — Qué se mantuvo, qué cambió (45 seg)

"Para cerrar el detalle técnico, un resumen rápido. Lo que se mantuvo:
cero cambios de comportamiento, el dominio completo, los 45 tests, y las
mismas librerías — Prisma, JWT, HMAC, WebSocket, scheduler — solo
reubicadas.

Lo que cambió: los nombres y la agrupación de carpetas, el vocabulario —de
anillos a puertos por dirección—, 25 interfaces nuevas de puerto in, y el
caso puntual de `PaymentMethod` que pasó de policy a puerto out."

---

## Slide 14 — Cierre (30 seg)

"En resumen: mismo dominio, mismas reglas de negocio, mismos tests — dos
formas distintas de organizar las carpetas alrededor de la misma regla de
dependencia. Onion piensa en anillos concéntricos; Hexagonal piensa en
puertos con dirección: **in** cuando algo entra a activar al núcleo, **out**
cuando el núcleo pide algo hacia afuera. Esa sola pregunta —¿quién llama a
quién?— es la que clasifica cada archivo del proyecto."

> nota: esta frase final es literalmente la misma que cierra la slide 6 —
> es intencional, es el hilo conductor de toda la charla. Dila con la misma
> cadencia que la primera vez.

---

## Slide 15 — Preguntas frecuentes (según tiempo disponible)

Esta slide ya trae las 4 preguntas con respuesta corta — no hace falta
leerla en voz alta si el tiempo aprieta, es tu respaldo para cuando el
jurado pregunte. Si sobra tiempo, puedes elegir una y desarrollarla:

- **¿Por qué no dejar el controller inyectando la clase directamente?** Es
  más simple, y muchas implementaciones "pragmáticas" de hexagonal lo hacen
  así. Se formalizó con fines didácticos, para que el contrato que cruza la
  frontera del hexágono quede explícito en el código.
- **¿Qué gana el proyecto con este cambio?** Nada en producción, mismo
  comportamiento. El valor es didáctico: mostrar que la regla de
  dependencia se puede expresar con vocabularios distintos.
- **¿`useExisting` no es un poco de magia de NestJS?** Es la forma que
  tiene Nest de decir "este token y esta clase apuntan a la misma
  instancia, no crees dos objetos".
- **¿Las policies no deberían ser puertos también?** Interfaz +
  implementación (patrón Strategy) no es lo mismo que "puerto hexagonal".
  Un puerto marca una frontera hacia el *exterior* del sistema; las
  policies nunca salen del núcleo.

---

## Slide 16 — Gracias / preguntas (—)

"Con esto termino la parte de arquitectura. Quedo abierto a preguntas."

> nota: si el jurado pide ver algo en vivo, ten a mano `docs/demo-runbook.md`
> — trae el checklist completo (registro, reserva, QR de ingreso, mapa en
> tiempo real, pago, QR de salida) por si piden una demo además de la
> explicación de arquitectura.

---

## Timing de respaldo

| Bloque | Slides | Tiempo |
|---|---|---|
| Apertura + concepto | 1-5 | ~4 min |
| El punto clave (WebSocket) | 6 | ~2 min |
| Flujo + código | 7-8 | ~3.5 min |
| Decisiones de diseño | 9-10 | ~2 min |
| Verificación | 11-12 | ~1.5 min |
| Cierre | 13-14 | ~1.5 min |
| **Total contenido** | | **~14.5 min** |

Si el tiempo aprieta, recorta primero la slide 12 (detalle de migración) y
resume la 13 (resumen) en una frase — el contenido irrecortable es 6, 7 y 8.

---
---

# Anexo — Guion extendido: comparativa, código y migración

Las slides 3, 7-8 y 12 del guion de arriba están comprimidas a propósito
para caber en 12-15 min. Esta sección desarrolla esos mismos tres puntos en
profundidad — úsala para:
- Responder si el jurado pide "explica eso con más detalle".
- Ensayar el code walkthrough en vivo (editor abierto, no solo la slide).
- Si te dan más tiempo de exposición (20+ min), reemplaza las slides 3, 7-8
  y 12 por estos bloques completos.

---

## A. Comparativa Onion vs Hexagonal, en profundidad (slide 3)

### A.1 — La diferencia de fondo (no es solo vocabulario)

"Antes de ver carpetas, quiero que quede clara la diferencia de fondo,
porque si no, esto parece que solo renombramos cosas.

Onion Architecture organiza el código por **nivel de pureza**: hay una
jerarquía de capas, y la regla es 'una capa solo puede depender de capas
más internas que ella'. Es un modelo de **círculos anidados** — por eso las
carpetas se llaman `domain`, `application`, `infrastructure`,
`presentation`, en ese orden de 'adentro hacia afuera'.

Hexagonal organiza el código por **rol en la comunicación**: no hay niveles,
hay un núcleo y todo lo demás son adaptadores. La pregunta ya no es '¿qué
tan profundo estás en la cebolla?', es '¿sos tú el que inicia la llamada, o
sos tú el que la recibe?'. Por eso las carpetas se llaman `in` y `out`, no
'capa 1, capa 2, capa 3'.

En la práctica, para un proyecto de este tamaño, las dos terminan
protegiendo lo mismo — el dominio no depende de Prisma ni de Express — pero
Hexagonal hace **explícita** una distinción que en Onion queda implícita:
que hay cosas que activan al sistema (un controller) y cosas que el sistema
activa (un repositorio), y que ambas viven 'afuera' del núcleo por igual,
sin importar cuál se sienta más 'cerca' del negocio."

### A.2 — Tabla de equivalencias (para mostrar o memorizar)

Úsala si te preguntan "¿dónde quedó tal cosa?":

| Onion (antes) | Hexagonal (después) | Nota |
|---|---|---|
| `src/domain/entities/` | `src/core/domain/entities/` | Sin cambios de contenido |
| `src/domain/enums/`, `errors/` | `src/core/domain/enums/`, `errors/` | Sin cambios |
| `src/domain/policies/` | `src/core/domain/policies/` | Se queda en domain — no es puerto (ver Decisión 1) |
| `src/domain/ports/*.repository.port.ts` | `src/core/ports/out/*.repository.port.ts` | Repositorios: eran "domain ports", ahora "ports out" |
| `src/domain/ports/tokens.ts` | dividido en `core/ports/out/tokens.ts` + `core/domain/policies/policy-tokens.ts` | Ver Decisión 5 en `arquitectura-hexagonal.md` |
| `src/application/use-cases/` | `src/core/application/use-cases/` | Sin cambios de lógica, `implements` un puerto in nuevo |
| `src/application/ports/tokens.ts` (clock, qr, jwt, hasher, notifier) | fusionado en `core/ports/out/tokens.ts` | Se unificó con los tokens de repos |
| *(no existía)* | `src/core/ports/in/**/*.port.ts` | **Nuevo**: 25 interfaces, una por caso de uso |
| `src/infrastructure/persistence/prisma/` | `src/adapters/out/persistence/prisma/` | Repos, mappers, prisma.service — reubicados, sin cambios |
| `src/infrastructure/auth/`, `qr/`, `payments/`, `clock/` | `src/adapters/out/auth\|qr\|payments\|clock/` | Reubicados por dirección, no por tecnología |
| `src/infrastructure/websocket/events.gateway.ts` | dividido: `adapters/in/websocket/events.gateway.ts` (conexión/salas) + `adapters/out/realtime/realtime-notifier.adapter.ts` (notificar) | **El caso que más sorprende** — mismo socket.io, dos roles distintos |
| `src/infrastructure/modules/*.module.ts` | `src/bootstrap/*.module.ts` | Composition root, ahora agrupa también wiring de puertos in |
| `src/presentation/http/controllers/` | `src/adapters/in/http/controllers/` | Ahora inyectan puerto (interfaz), no la clase del caso de uso |
| `src/presentation/http/{dto,guards,decorators,filters}/` | `src/adapters/in/http/{dto,guards,decorators,filters}/` | Reubicados sin cambios |
| `src/app.module.ts`, `src/main.ts` | `src/bootstrap/app.module.ts`, `src/bootstrap/main.ts` | `nest-cli.json entryFile` actualizado a `bootstrap/main` |

### A.3 — Por qué elegimos hacer este ejercicio (si preguntan "¿y para qué?")

"No es que Hexagonal sea 'mejor' que Onion para este proyecto — ambas
imponen la misma regla de dependencia. El valor de hacerlo fue **didáctico
y deliberado**: nos obligó a clasificar cada archivo por una pregunta
distinta ('¿quién llama a quién?' en vez de '¿qué tan puro es esto?'), y
esa clasificación sacó a la luz un par de cosas que en Onion estaban un
poco escondidas — como que `PaymentMethod` sí cruza a infraestructura real
y las policies no, algo que antes vivía junto en la misma carpeta sin esa
distinción."

---

## B. Explicación del código, walkthrough completo (slides 7-8)

> nota: para esta parte lo ideal es tener el editor abierto en vivo, no solo
> la slide. Sigue este orden de archivos, con el editor real:

**Orden de archivos a abrir (en este orden exacto):**

1. `backend/src/adapters/in/http/controllers/reservations.controller.ts`
2. `backend/src/core/ports/in/reservations/create-reservation.port.ts`
3. `backend/src/core/application/use-cases/reservations/create-reservation.use-case.ts`
4. `backend/src/core/ports/out/reservation.repository.port.ts`
5. `backend/src/adapters/out/persistence/prisma/repositories/prisma-reservation.repository.ts`
6. `backend/src/core/ports/out/realtime-notifier.port.ts` (buscar `tokens.ts` al lado)
7. `backend/src/adapters/out/realtime/realtime-notifier.adapter.ts`
8. `backend/src/bootstrap/reservations.module.ts`

### B.1 — Paso 1: el controller (adaptador in)

`[PANTALLA: reservations.controller.ts, constructor]`

"Miren el constructor. Antes de este refactor decía:

```ts
constructor(private readonly createReservation: CreateReservationUseCase) {}
```

Ahora dice:

```ts
constructor(
  @Inject(CREATE_RESERVATION)
  private readonly createReservation: CreateReservationPort,
  ...
) {}
```

El tipo cambió de una **clase** (`CreateReservationUseCase`) a una
**interfaz** (`CreateReservationPort`). El controller compila igual, se usa
igual (`this.createReservation.execute(...)`), pero ya no puede acceder a
nada que no esté en la interfaz — no puede, por ejemplo, llamar un método
privado del caso de uso ni asumir detalles de implementación. Es
acoplamiento a un contrato, no a una clase concreta."

### B.2 — Paso 2: el puerto in (la interfaz)

`[PANTALLA: create-reservation.port.ts]`

"Este archivo es nuevo, no existía en Onion. Son tres líneas:

```ts
export interface CreateReservationPort {
  execute(input: CreateReservationInput): Promise<CreateReservationResult>;
}
```

Este es *todo* el contrato que el controller conoce. `CreateReservationInput`
y `CreateReservationResult` también son tipos que ya existían — no
inventamos tipos nuevos, solo envolvimos la firma del método `execute` en
una interfaz con nombre propio."

### B.3 — Paso 3: el caso de uso (el núcleo)

`[PANTALLA: create-reservation.use-case.ts, primera línea de la clase]`

"Esta es la misma clase de siempre. El único cambio de esta línea:

```ts
export class CreateReservationUseCase implements CreateReservationPort {
```

Se agregó `implements CreateReservationPort`. TypeScript ahora obliga a que
la clase tenga un método `execute` con exactamente esa firma — si alguien
cambia el nombre del método o el tipo de retorno sin actualizar el puerto,
no compila. Es una red de seguridad, no solo una anotación.

Adentro de la clase, busquen las líneas que llaman a `this.reservationPolicy`
y `this.slotAssignmentPolicy` — esas siguen siendo inyección directa de
clase concreta a través de un token de policy (`RESERVATION_POLICY`,
`SLOT_ASSIGNMENT_POLICY`), **no** son puertos hexagonales, son Strategy
interno. Y busquen `this.reservationRepository.save(...)` y
`this.notifier.notifyReservationCreated(...)` — esos sí son llamadas a
**puertos out**."

### B.4 — Paso 4 y 5: el puerto out y su adaptador Prisma

`[PANTALLA: reservation.repository.port.ts, luego prisma-reservation.repository.ts]`

"El puerto out es una interfaz normal de repositorio: `save`, `findById`,
`findActiveByUserId`, etc. — nada nuevo respecto a Onion, esta interfaz ya
existía, solo cambió de carpeta.

El adaptador Prisma es la clase concreta que implementa esa interfaz con
código real de base de datos. Fíjense que la clase se llama
`PrismaReservationRepository implements ReservationRepositoryPort` — el
patrón es idéntico al del puerto in, solo que en la dirección opuesta: acá
es el **adaptador** el que implementa el **puerto**, mientras que en el
puerto in era el **caso de uso** el que implementaba el **puerto**. Esa
simetría es intencional: un puerto siempre lo implementa quien está del
lado 'externo' de la conversación — el adaptador out, o el caso de uso
cuando el puerto es in."

### B.5 — Paso 6 y 7: el notificador (el caso que sorprende, en código)

`[PANTALLA: realtime-notifier.port.ts, luego realtime-notifier.adapter.ts]`

"Mismo patrón otra vez: `RealtimeNotifierPort` define
`notifyReservationCreated(...)`, y `RealtimeNotifierAdapter implements
RealtimeNotifierPort` usa Socket.IO por debajo para emitir el evento a la
sala de la sucursal correspondiente. Es exactamente el mismo patrón
in/out que el repositorio — la única diferencia es que la tecnología detrás
es un socket en vez de SQL, pero como vimos en la slide 6, eso no cambia
que sea un puerto **out**."

### B.6 — Paso 8: el wiring en bootstrap

`[PANTALLA: reservations.module.ts]`

```ts
@Module({
  providers: [
    CreateReservationUseCase,
    { provide: CREATE_RESERVATION, useExisting: CreateReservationUseCase },
    // ...otros casos de uso del mismo módulo
  ],
  controllers: [ReservationsController],
})
export class ReservationsModule {}
```

"Dos líneas por caso de uso: una que registra la clase normal (para que
Nest la instancie con sus propias dependencias), y una que mapea el token
del puerto a esa misma instancia con `useExisting`. Si se les olvida la
segunda línea, Nest tira un error en arranque — `Nest can't resolve
dependencies of ReservationsController (?)` — porque el token
`CREATE_RESERVATION` no está provisto por nadie. Ese error, de hecho, es la
prueba de humo de todo el cableado (ver slide 11)."

---

## C. La migración de 201 archivos, paso a paso (slide 12)

"Nos preguntan seguido cómo migramos 201 archivos sin romper nada a mano.
Este fue el proceso real, en orden:"

### C.1 — Paso 1: crear el esqueleto de carpetas nuevo

Se crearon las carpetas vacías `core/ports/in/`, `core/ports/out/`,
`adapters/in/`, `adapters/out/`, `bootstrap/`, sin mover nada todavía.

### C.2 — Paso 2: mover con `git mv`, no copiar/pegar

"Usamos `git mv origen destino` para cada archivo o carpeta, nunca
copiar-y-pegar-y-borrar. La diferencia importa: `git mv` le dice a Git
explícitamente 'este archivo se movió', y aunque Git igual puede detectar
renombres por similitud de contenido, hacerlo explícito evita falsos
negativos — sobre todo en archivos cortos, donde Git a veces no logra
inferir que un archivo de 10 líneas 'es' el mismo que otro de 10 líneas en
otra carpeta. Resultado: `git log --follow` sobre cualquier archivo movido
sigue mostrando su historia completa desde antes del refactor."

Orden de movimiento (de menor a mayor riesgo de romper imports):
1. `domain/entities`, `enums`, `errors` → `core/domain/` (no dependen de nada más)
2. `domain/policies` → `core/domain/policies/` (dependen de entities)
3. `domain/ports/*.repository.port.ts` + `application/ports/tokens.ts` → se fusionan en `core/ports/out/`
4. `application/use-cases/` → `core/application/use-cases/` (dependen de todo lo anterior)
5. `infrastructure/*` → `adapters/out/*` (implementan los puertos out)
6. `presentation/*` → `adapters/in/http/*`, más `scheduler` y `websocket` reclasificados como `adapters/in/`
7. Módulos NestJS → `bootstrap/*.module.ts`, `app.module.ts` y `main.ts` al final

### C.3 — Paso 3: crear los 25 puertos "in" (código nuevo, no movido)

"A diferencia de todo lo anterior, que era mover archivos existentes, los
puertos `in` son las únicas interfaces genuinamente **nuevas** del refactor
— una por cada caso de uso, definidas mirando la firma pública de
`execute(...)` que el caso de uso ya tenía."

### C.4 — Paso 4: reescribir imports automáticamente

"Con 201 archivos movidos, las rutas relativas (`../../domain/entities/...`)
quedaron todas rotas. En vez de corregir a mano, se corrió un script que:
1. Recorre todos los `.ts` del proyecto.
2. Por cada `import ... from '<ruta relativa>'`, resuelve a qué archivo
   apunta la ruta vieja.
3. Busca dónde quedó ese archivo después del `git mv`.
4. Reescribe el import con la ruta relativa nueva.

Esto evitó el error humano de mover 201 archivos y después perseguir
manualmente cientos de imports rotos uno por uno."

### C.5 — Paso 5: verificar en cada hito grande, no al final

"No se hizo todo el movimiento y después se compiló una sola vez. Después
de cada paso grande de la lista C.2 —policies, luego use-cases, luego
infrastructure, luego presentation— se corrió `npx tsc --noEmit` y
`npm test`. Si algo fallaba, el conjunto de archivos recién movidos era
pequeño y era fácil aislar el import roto, en vez de tener que revisar 201
archivos de una sola vez al final."

### C.6 — Paso 6: los ajustes de configuración (fáciles de olvidar)

"Al mover `main.ts` a `bootstrap/main.ts`, el punto de entrada del build
cambió. Tres archivos de configuración necesitaron un ajuste de una línea
cada uno:
- `nest-cli.json` → `entryFile: 'bootstrap/main'`
- `Dockerfile` → el `CMD`/`ENTRYPOINT` que apunta a `dist/src/bootstrap/main.js`
- `package.json` → script `start:prod`
- `docker-compose.yml` → si referenciaba la ruta del build

Son el tipo de detalle que si se olvida, todo compila y todos los tests
pasan localmente, pero el contenedor Docker no arranca — por eso el
runbook de verificación (slide 11) incluye `npm run build` explícitamente,
no solo `tsc --noEmit`."

### C.7 — Resumen de una frase (si te piden resumir todo el proceso)

"Mover de adentro hacia afuera según dependencias, con `git mv` para no
perder historial, imports reescritos por script en vez de a mano, y
recompilar + testear después de cada hito — nunca al final."
