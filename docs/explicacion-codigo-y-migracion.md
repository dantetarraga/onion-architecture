# Explicación didáctica: el código desde el editor, la migración y sus implicancias

Este documento es distinto de `guion-presentacion-pptx.md`: aquel es un
**guion para hablar** con timing de diapositivas; este es una
**guía de estudio/enseñanza** para explicar el código abriendo el editor de
verdad, entender cómo se hizo la migración, y razonar sobre sus
implicancias — útil tanto para prepararte como para responder preguntas
de fondo del jurado.

Está organizado en tres partes independientes:
1. **Leer el código desde el editor** — qué abrir, en qué orden, qué mirar.
2. **Cómo se hizo la migración** — el proceso real, con evidencia de `git`.
3. **Implicancias** — qué se gana, qué cuesta, cuándo vale la pena.

---

## Parte 1 — Leer el código desde el editor

### 1.1 Mapa mental antes de abrir nada

Antes de mostrar un solo archivo, el jurado necesita esta idea en la
cabeza, porque si no, el recorrido por carpetas no dice nada:

> **Todo archivo del backend responde a una sola pregunta: ¿este código
> activa al núcleo del sistema, o el núcleo lo usa a él?**
> Si activa al núcleo → vive en `adapters/in/` (si es código externo) o es
> un `ports/in/*.port.ts` (si es el contrato). Si el núcleo lo usa → vive
> en `adapters/out/` (si es código externo) o es un `ports/out/*.port.ts`
> (si es el contrato).

Con esa sola regla se puede predecir en qué carpeta está *cualquier*
archivo del proyecto sin haberlo visto antes. Es el ejercicio que vale la
pena hacer en vivo: pedirle al público que adivine dónde vive el archivo
que gestiona el pago con Yape, o el que valida el JWT, antes de abrirlo.

### 1.2 Recorrido guiado: `POST /reservations`

Abre estos 8 archivos **en este orden**, en el editor real (no solo la
slide). Cada uno tiene su ruta completa para que los tengas a mano.

#### Archivo 1 — El controller (adaptador `in`)

`backend/src/adapters/in/http/controllers/reservations.controller.ts`

```ts
constructor(
  @Inject(CREATE_RESERVATION)
  private readonly createReservation: CreateReservationPort,
  @Inject(CANCEL_RESERVATION)
  private readonly cancelReservation: CancelReservationPort,
  // ...
) {}

@Post()
create(@CurrentUser() user: AuthTokenPayload, @Body() dto: CreateReservationDto) {
  return this.createReservation.execute({
    userId: user.sub,
    branchId: dto.branchId,
    slotType: dto.slotType,
    startAt: dto.startAt ? new Date(dto.startAt) : undefined,
  });
}
```

**Qué señalar:** el tipo del campo `createReservation` es
`CreateReservationPort` — una interfaz — no
`CreateReservationUseCase` — una clase. El `@Inject(CREATE_RESERVATION)`
es un token (un `Symbol`) que Nest usa para saber *qué instancia real*
poner ahí en tiempo de ejecución, porque TypeScript borra los tipos al
compilar a JS y ya no se puede usar la interfaz misma como identificador
de inyección.

**Pregunta para lanzar al público aquí:** "¿Qué pasaría si mañana
cambiamos completamente la implementación de crear una reserva, pero
mantenemos la misma firma de entrada/salida? ¿Hay que tocar este
archivo?" — Respuesta: no, cero cambios en el controller.

#### Archivo 2 — El puerto `in` (el contrato)

`backend/src/core/ports/in/reservations/create-reservation.port.ts`

```ts
import type {
  CreateReservationInput,
  CreateReservationResult,
} from '../../../application/use-cases/reservations/create-reservation.use-case';

export interface CreateReservationPort {
  execute(input: CreateReservationInput): Promise<CreateReservationResult>;
}
```

**Qué señalar:** este archivo es **puro TypeScript sin ningún import de
NestJS, Express o Prisma**. Es literalmente tres líneas de interfaz. Todo
puerto `in` de este proyecto tiene esta forma: un método `execute`, un
input, un output. Vale la pena abrir `core/ports/in/tokens.ts` al lado y
mostrar que hay 25 símbolos (`Symbol(...)`) — uno por cada puerto —
agrupados por dominio (`auth`, `admin`, `branches`, `parking`, `payments`,
`reservations`, `users`).

#### Archivo 3 — El caso de uso (el núcleo)

`backend/src/core/application/use-cases/reservations/create-reservation.use-case.ts`

```ts
export class CreateReservationUseCase implements CreateReservationPort {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepositoryPort,
    @Inject(RESERVATION_POLICY) private readonly reservationPolicy: ReservationPolicy,
    @Inject(SLOT_ASSIGNMENT_POLICY) private readonly slotAssignmentPolicy: SlotAssignmentPolicy,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(REALTIME_NOTIFIER) private readonly notifier: RealtimeNotifierPort,
  ) {}

  async execute(input: CreateReservationInput): Promise<CreateReservationResult> {
    const eligibility = await this.reservationPolicy.canCreateReservation(input.userId);
    if (!eligibility.allowed) throw new ReservationAlreadyActiveError();

    const assignment = await this.slotAssignmentPolicy.assign({
      branchId: input.branchId,
      slotType: input.slotType,
    });
    // ...
  }
}
```

**Qué señalar — este es el archivo con más para explicar:**
- `implements CreateReservationPort`: es lo único que cambió respecto a la
  versión Onion de este archivo. La lógica de adentro (líneas de
  `execute`) es **exactamente la misma** que antes del refactor.
- Fíjate en los **cinco `@Inject`** del constructor: dos son *policies*
  (`RESERVATION_POLICY`, `SLOT_ASSIGNMENT_POLICY`) y tres son *puertos out*
  (`RESERVATION_REPOSITORY`, `CLOCK`, `REALTIME_NOTIFIER`). Se ven
  idénticos en el código — mismo decorador, mismo patrón de token — pero
  **conceptualmente son cosas distintas** (ver 1.3 y la Decisión 1 del
  guion de exposición). Este es el mejor punto del código para mostrar que
  la distinción in/out/policy es una decisión de diseño, no algo que el
  compilador te obligue a marcar diferente.
- El método `execute` nunca importa `PrismaService`, nunca importa
  `socket.io`, nunca importa nada de `@nestjs/websockets`. Solo conoce
  interfaces.

#### Archivo 4 — El puerto `out` del repositorio (el contrato)

`backend/src/core/ports/out/reservation.repository.port.ts`

```ts
export interface ReservationRepositoryPort {
  findById(id: string): Promise<Reservation | null>;
  findActiveByUser(userId: string): Promise<Reservation | null>;
  findExpiredPending(now: Date): Promise<Reservation[]>;
  create(data: CreateReservationData): Promise<Reservation>;
  updateStatus(id: string, status: ReservationStatus, confirmedAt?: Date): Promise<void>;
  listByUser(userId: string): Promise<Reservation[]>;
  listByFilters(filters: ReservationListFilters): Promise<Reservation[]>;
}
```

**Qué señalar:** compara esta interfaz con la del Archivo 2
(`CreateReservationPort`). Misma idea — puro contrato, cero
infraestructura — pero **la dirección de la implementación se invierte**:
al puerto `in` lo implementa el caso de uso (el núcleo); a este puerto
`out` lo va a implementar un adaptador (afuera). Ese es el patrón general:
*quien implementa un puerto siempre está del lado "externo" de esa
conversación particular.*

#### Archivo 5 — El adaptador Prisma (implementación real)

`backend/src/adapters/out/persistence/prisma/repositories/prisma-reservation.repository.ts`

```ts
@Injectable()
export class PrismaReservationRepository implements ReservationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Reservation | null> {
    const record = await this.prisma.reservation.findUnique({ where: { id } });
    return record ? ReservationMapper.toDomain(record) : null;
  }
  // ...
}
```

**Qué señalar:** aquí sí aparece Prisma, SQL, y el `ReservationMapper`
que convierte entre el registro de base de datos y la entidad de dominio
`Reservation`. Este archivo es el único de los cinco que puede cambiar
libremente de tecnología (Prisma → TypeORM → Mongo) sin que ningún otro
archivo del recorrido se entere, siempre que siga cumpliendo
`ReservationRepositoryPort`.

#### Archivos 6 y 7 — El caso que sorprende, en código

`backend/src/core/ports/out/realtime-notifier.port.ts` +
`backend/src/adapters/out/realtime/realtime-notifier.adapter.ts`

```ts
// ports/out/realtime-notifier.port.ts
export interface RealtimeNotifierPort {
  notifyReservationCreated(payload: { reservationId: string; branchId: string; slotId: string; userId: string; expiresAt: Date }): void;
  // ...7 métodos más
}
```

```ts
// adapters/out/realtime/realtime-notifier.adapter.ts
export class RealtimeNotifierAdapter implements RealtimeNotifierPort {
  constructor(
    private readonly gateway: EventsGateway,
    @Inject(PARKING_SLOT_REPOSITORY) private readonly slots: ParkingSlotRepositoryPort,
  ) {}

  notifyReservationCreated(payload): void {
    this.emitToBranch(payload.branchId, 'reservation.created', payload);
  }
}
```

Y al lado, el archivo que se ve "hermano" pero vive en otra carpeta:

```ts
// adapters/in/websocket/events.gateway.ts
export class EventsGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  constructor(@Inject(TOKEN_SERVICE) private readonly tokenService: TokenPort) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    // valida el JWT del socket entrante, gestiona salas...
  }
}
```

**Qué señalar:** `RealtimeNotifierAdapter` **usa** `EventsGateway`
(lo inyecta en su constructor) para poder emitir (`this.gateway.server.to(...)`),
pero son responsabilidades opuestas: `EventsGateway` reacciona a conexiones
que llegan (`in`), `RealtimeNotifierAdapter` empuja notificaciones hacia
afuera cuando el núcleo se lo pide (`out`). Mismo `socket.io` por debajo,
dos carpetas distintas, porque la clasificación es por rol, no por
librería.

#### Archivo 8 — El wiring (`bootstrap`)

`backend/src/bootstrap/reservations.module.ts`

```ts
@Module({
  controllers: [ReservationsController],
  providers: [
    CreateReservationUseCase,
    CancelReservationUseCase,
    // ...
    { provide: CREATE_RESERVATION, useExisting: CreateReservationUseCase },
    { provide: CANCEL_RESERVATION, useExisting: CancelReservationUseCase },
    // ...
  ],
  exports: [EXPIRE_OVERDUE_RESERVATIONS],
})
export class ReservationsModule {}
```

**Qué señalar:** por cada caso de uso hay **dos** entradas en `providers`:
la clase tal cual (para que Nest la instancie con sus propias dependencias
resueltas), y un `{ provide: TOKEN, useExisting: Clase }` que le dice a
Nest "el token resuelve a esa misma instancia, no crees una segunda". Este
archivo es el único lugar de todo el recorrido que conoce **tanto** el
token del puerto **como** la clase concreta — es literalmente el
"enchufe" físico entre las dos mitades del sistema.

### 1.3 Cómo distinguir in / out / "no es puerto" por tu cuenta

Si te preguntan por un archivo que no preparaste, esta es la heurística de
tres preguntas, en orden:

1. **¿Este código cruza hacia infraestructura real** (red, disco, base de
   datos, un proceso externo, un reloj del sistema operativo)?
   - No → no es un puerto hexagonal, es una regla de negocio interna
     (policy, entidad, servicio de dominio). Vive en `core/domain/`.
   - Sí → sigue a la pregunta 2.
2. **¿Quién inicia la llamada — algo externo llama al núcleo, o el núcleo
   llama hacia afuera?**
   - Algo externo llama al núcleo → es `in`.
   - El núcleo llama hacia afuera → es `out`.
3. **¿Es el contrato (interfaz) o la implementación concreta?**
   - Contrato → `core/ports/in|out/*.port.ts`.
   - Implementación concreta → `adapters/in|out/...`.

Ejercicio en vivo sugerido: pedir al público que clasifique 2-3 archivos
que no se muestran en el recorrido — por ejemplo
`bcrypt-password-hasher.adapter.ts` (out, cruza a una librería de hashing)
o `reservation-expiration.scheduler.ts` (in, el cron dispara al núcleo).

---

## Parte 2 — Cómo se hizo la migración

### 2.1 Qué evidencia deja `git` (para no inventar el proceso)

Antes de explicar pasos, esto es lo que se puede **verificar** con
comandos, no solo lo que se recuerda haber hecho:

```
git show --stat -M f30967e
```

Muestra **201 archivos** tocados en el commit `f30967e` ("refactor a
exagonal"), de los cuales **23 aparecen como rename explícito**
(`ruta/vieja.ts => ruta/nueva.ts`) porque Git detectó suficiente similitud
de contenido entre el archivo viejo y el nuevo. El resto aparece como
líneas `+`/`-` normales, principalmente porque **al mismo tiempo que se
movió el archivo se reescribieron sus imports relativos** — eso baja el
porcentaje de similitud de texto por debajo del umbral que Git usa para
detectar un rename automáticamente, aunque el archivo sea "el mismo".

Para confirmar que el historial no se perdió en esos casos, se puede correr:

```
git log --follow --oneline -- backend/src/core/domain/entities/branch.entity.ts
```

Y sí devuelve commits **anteriores** al refactor (por ejemplo
`40e6b6b feat: add branches page and reservation modal`), lo que confirma
que Git conservó la conexión con el archivo original aunque cambió de
carpeta y de contenido en el mismo commit.

> **Nota honesta para cuando pregunten "¿qué script usaron?":** el commit
> se hizo en un solo paso grande y el repo no conserva un script de
> migración como artefacto aparte — lo que sí se puede mostrar, con
> comandos de `git` reales (arriba), es la *evidencia* del resultado:
> historial preservado y una proporción alta de archivos detectados como
> movidos. Es más honesto decir "así es como se puede comprobar que se
> preservó el historial" que inventar el detalle exacto de la herramienta
> usada paso a paso.

### 2.2 El orden lógico (por qué importa el orden)

Independientemente de la herramienta exacta, el orden **tiene** que
respetar el grafo de dependencias del proyecto — si se mueve algo que otro
archivo importa antes de mover ese "otro archivo", el import se rompe
inmediatamente. El orden que respeta las dependencias de este proyecto es:

```
1. domain/entities, enums, errors     (no dependen de nada más del proyecto)
2. domain/policies                    (dependen de entities)
3. ports (in y out)                   (dependen de entities/enums, y los use-cases dependerán de ellos)
4. application/use-cases              (dependen de 1, 2 y 3)
5. infrastructure -> adapters/out     (implementan los puertos out del paso 3)
6. presentation -> adapters/in        (implementan/usan los puertos in del paso 3)
7. módulos NestJS -> bootstrap        (conocen todo lo anterior, van al final)
```

**Por qué esto es didáctico:** este orden es, literalmente, el mismo orden
en que hay que *leer* el proyecto para entenderlo de cero — de adentro
(entidades) hacia afuera (wiring). Migrar en ese orden no es casualidad,
es la misma regla de dependencia que hace que la arquitectura funcione.

### 2.3 Qué cambia además de la carpeta

Mover un archivo de carpeta no es gratis en TypeScript: todo import
relativo (`../../domain/entities/branch.entity`) apunta a una ruta que ya
no existe. Esto obliga a:

1. Recalcular la ruta relativa nueva para cada import, en cada archivo
   movido — puede hacerse con la función de "update imports on move" de
   VSCode/WebStorm si se mueven los archivos desde el explorador del IDE,
   o reescribiendo a mano/con un script si se usa `git mv` por terminal.
2. Ajustar los **tres puntos de configuración** que apuntaban a rutas del
   código viejo y que **no truena en `tsc`, solo en runtime o en
   Docker** si se olvidan:
   - `nest-cli.json` → `entryFile` (pasó de `app` a `bootstrap/main`).
   - `Dockerfile` → el `CMD`/`ENTRYPOINT` que apunta a
     `dist/src/bootstrap/main.js`.
   - `package.json` → script `start:prod`.

   Este último punto es el que más vale la pena remarcar: **un refactor de
   este tipo puede compilar perfecto y pasar todos los tests, y aun así
   romper el `docker-compose` o el deploy**, porque `tsc` no valida rutas
   de shell scripts ni de Dockerfiles. Por eso el checklist de
   verificación (parte 2.4) incluye `npm run build` y no solo
   `tsc --noEmit`.

### 2.4 Verificación incremental, no al final

La forma correcta de hacer un refactor de 201 archivos es **verificar
después de cada bloque de la lista 2.2**, no una sola vez al terminar todo:

```
# después de mover domain/ + policies/
npx tsc --noEmit

# después de mover ports/ + use-cases/
npx tsc --noEmit && npm test

# después de mover infrastructure -> adapters/out
npx tsc --noEmit && npm test

# después de mover presentation -> adapters/in + bootstrap
npx tsc --noEmit && npm test && npm run build
```

**Por qué importa didácticamente:** si el error aparece después de mover
30 archivos de `domain/`, el universo de sospechosos es esos 30 archivos.
Si se mueven los 201 de una y recién ahí se compila, el error puede estar
en cualquiera de los 201 — el costo de debuggear crece mucho más rápido
que el número de archivos.

---

## Parte 3 — Implicancias (qué se gana, qué cuesta, cuándo vale la pena)

### 3.1 Qué se gana

- **Contratos explícitos en ambas direcciones.** En Onion, el límite
  "adentro/afuera" existía en la cabeza del equipo y en la carpeta
  `domain/ports`, pero solo para lo que el núcleo *necesitaba*. Nada
  formalizaba lo que el núcleo *exponía*. Ahora ambos lados tienen una
  interfaz con nombre propio (`ports/in`, `ports/out`).
- **Un vocabulario que fuerza a clasificar, no solo a organizar.** El
  ejercicio de decidir "¿esto es puerto o no?" (ver Decisión 1 y 2 del
  guion de exposición) hizo evidente algo que en Onion estaba mezclado sin
  problema: `PaymentMethod` y las *policies* usaban el mismo patrón
  interfaz+implementación, pero solo uno de los dos cruza a
  infraestructura real. Onion no obligaba a esa distinción; Hexagonal sí.
- **Simetría conceptual.** Puerto `in` lo implementa el núcleo; puerto
  `out` lo implementa el adaptador. Es la misma regla del Dependency
  Inversion Principle (SOLID) aplicada en ambas direcciones, y una vez que
  se entiende para un caso de uso, se entienden los otros 24 sin
  explicación adicional — son mecánicos.

### 3.2 Qué cuesta

- **25 interfaces nuevas que antes no existían.** Cada una es un archivo
  de 3-5 líneas, pero es 25 archivos más para navegar, 25 símbolos más de
  DI, y 25 líneas más de `useExisting` en los módulos de `bootstrap`. Es
  ceremonia real, no gratis.
- **Un salto extra al leer código por primera vez.** Antes, "control-click"
  desde el controller llevaba directo a la clase del caso de uso. Ahora
  lleva primero a la interfaz, y hay que dar un salto más
  (buscar la implementación) para llegar a la lógica real. Para alguien
  que recién entra al proyecto, es una fricción medible, aunque pequeña.
- **El riesgo de "puerto por moda".** Nada obliga, técnicamente, a que
  *todo* método público de un caso de uso tenga su propio puerto — se hizo
  así aquí por consistencia didáctica (25 puertos, uno por caso de uso),
  pero en un proyecto real muchos equipos solo formalizan como puerto lo
  que de verdad tiene más de una implementación o más de un consumidor. Acá
  el propio documento de arquitectura señala la excepción: cuando un caso
  de uso llama a *otro* caso de uso (`GetOccupancyDashboardUseCase` llama a
  `CompareBranchesOccupancyUseCase`), se dejó sin puerto a propósito, por
  ser colaboración interna sin valor en formalizarla.

### 3.3 ¿Vale la pena hacerlo en un proyecto real (no académico)?

Respuesta honesta para dar si preguntan esto: **depende del motivo**, no
del tamaño del proyecto:

- Si el objetivo es **cambiar de framework/DB en el futuro** (ej. de
  Prisma a otro ORM, o de NestJS a Express puro), Hexagonal no da más
  protección real que Onion — la regla de dependencia (dominio no conoce
  infraestructura) ya la daba Onion, y **eso** es lo que realmente protege
  contra ese cambio, no el nombre de las carpetas.
- Si el objetivo es **enseñar o dejar explícito, en el código mismo,
  quién llama a quién**, sin depender de que el equipo lo sepa de memoria
  ni de que esté documentado aparte — ahí Hexagonal aporta algo que Onion
  no fuerza: la pregunta de clasificación queda **grabada en la estructura
  de carpetas**, no solo en la cabeza de quien diseñó el sistema.
- El caso de uso más real de esto en la industria no es "migrar un
  proyecto existente" (como se hizo aquí, con fines de aprendizaje) sino
  **arrancar un proyecto nuevo** ya con esta estructura, cuando el equipo
  ya tiene experiencia con el patrón y quiere el contrato explícito desde
  el día uno — ahí el costo de las 25 interfaces se diluye porque se
  escriben junto con el caso de uso, no se agregan después sobre código ya
  existente.

### 3.4 Relación con principios de diseño conocidos (para amarrar con la teoría del curso)

- **Dependency Inversion Principle (la "D" de SOLID):** tanto Onion como
  Hexagonal son, en el fondo, aplicaciones sistemáticas de este principio
  — los módulos de alto nivel (el núcleo) no dependen de módulos de bajo
  nivel (infraestructura), ambos dependen de abstracciones (los puertos).
  Hexagonal simplemente nombra "puerto" a esa abstracción y la separa por
  dirección.
- **Interface Segregation Principle:** los 25 puertos `in`, uno por caso
  de uso, son ISP llevado al extremo — ningún consumidor depende de un
  método que no usa, porque cada interfaz tiene un solo método
  (`execute`).
- **Strategy pattern (no es DIP/puerto):** las *policies*
  (`SlotAssignmentPolicy`, `PricingPolicy`, etc.) también usan
  interfaz + implementación, pero es el patrón Strategy clásico — varias
  implementaciones intercambiables de una misma regla — no un puerto
  hexagonal, porque nunca cruzan la frontera hacia infraestructura externa.
  Vale la pena remarcar esta diferencia porque es la pregunta más común
  del jurado (ver FAQ del guion de exposición).

---

## Glosario rápido

| Término | Significado en este proyecto |
|---|---|
| **Núcleo / hexágono** | `core/` — dominio + casos de uso. Cero imports de NestJS, Express o Prisma. |
| **Puerto** | Una interfaz que marca una frontera hacia el exterior del núcleo. Vive en `core/ports/in/` o `core/ports/out/`. |
| **Adaptador** | La implementación concreta de un puerto, con tecnología real (Prisma, JWT, Socket.IO...). Vive en `adapters/in/` o `adapters/out/`. |
| **Puerto/adaptador `in`** | Algo de afuera *activa* al núcleo (controller, cron, websocket que recibe mensajes). |
| **Puerto/adaptador `out`** | El núcleo *pide* algo al exterior (repositorio, reloj, notificador, servicio de pago). |
| **`bootstrap/`** | El composition root: módulos de NestJS que conectan cada token de puerto con su clase concreta (`useExisting`). |
| **Policy** | Regla de negocio con implementación intercambiable (Strategy) que **nunca** cruza a infraestructura — no es un puerto aunque use el mismo patrón interfaz+implementación. |
| **Token de DI** | Un `Symbol` (ej. `CREATE_RESERVATION`) que Nest usa para saber qué instancia inyectar donde el tipo es una interfaz (que no existe en JS compilado). |

---

## Documentos relacionados

- `docs/arquitectura-hexagonal.md` — referencia técnica completa (estructura de carpetas, las 5 decisiones de clasificación).
- `docs/guion-presentacion-pptx.md` — guion cronometrado para exponer con el `.pptx`, más el anexo de comparativa/código/migración condensado.
- `docs/demo-runbook.md` — checklist para demo en vivo de la aplicación.
