# Presentación: evolución hacia Clean Architecture

## Objetivo

Explicar la arquitectura actual del backend del sistema de estacionamiento, el cambio realizado desde una arquitectura más acoplada y cómo se interpreta o se puede completar como una **Clean Architecture** estricta.

> Idea central: la arquitectura no busca tener más carpetas, sino proteger las reglas de negocio de tecnologías que pueden cambiar, como NestJS, HTTP, MongoDB, JWT o WebSocket.

---

## Diapositiva 1: problema que queremos resolver

En una aplicación tradicional es común mezclar en un mismo módulo:

- La recepción de peticiones HTTP.
- La validación de datos.
- Las reglas de negocio.
- Las consultas a la base de datos.
- Detalles del framework.

Esto suele verse así:

```text
Controller → Service → Prisma / MongoDB / PostgreSQL
```

El problema es que la lógica de negocio termina dependiendo de detalles técnicos. Por ejemplo, cambiar de base de datos puede obligar a modificar servicios, controladores y pruebas.

### Qué decir

> Si las reglas de reservas dependen directamente de MongoDB o de NestJS, cambiar una tecnología se vuelve costoso. Nuestro objetivo es que la regla “un usuario no puede tener dos reservas activas” exista independientemente de la base de datos o del tipo de interfaz.

---

## Diapositiva 2: arquitectura actual del proyecto

El backend ya sigue principalmente una arquitectura **hexagonal** o de **puertos y adaptadores**, que es compatible con los principios de Clean Architecture.

```text
backend/src
├── core/
│   ├── domain/              Entidades, reglas, políticas y errores
│   ├── application/         Casos de uso
│   └── ports/               Contratos de entrada y salida
├── adapters/
│   ├── in/                  HTTP, WebSocket y scheduler
│   └── out/                 MongoDB, JWT, bcrypt, QR, pagos y tiempo real
└── bootstrap/               Ensamblaje e inyección de dependencias con NestJS
```

### Qué decir

> El `core` contiene el comportamiento del negocio. Los adaptadores conectan ese núcleo con el exterior. Finalmente, `bootstrap` decide qué implementación concreta se utilizará en tiempo de ejecución.

---

## Diapositiva 3: Clean Architecture y regla de dependencias

Clean Architecture organiza el sistema en capas concéntricas. Las dependencias siempre apuntan hacia adentro.

```text
┌──────────────────────────────────────────────┐
│ Frameworks y drivers                          │
│ NestJS · HTTP · MongoDB · JWT · WebSocket     │
│  ┌────────────────────────────────────────┐  │
│  │ Adaptadores de interfaz                 │  │
│  │ Controllers · DTOs · Repositorios       │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │ Aplicación                        │  │  │
│  │  │ Casos de uso · Puertos            │  │  │
│  │  │  ┌────────────────────────────┐  │  │  │
│  │  │  │ Dominio                     │  │  │  │
│  │  │  │ Entidades · Políticas ·     │  │  │  │
│  │  │  │ Reglas de negocio           │  │  │  │
│  │  │  └────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

La dirección correcta es:

```text
Infraestructura → Aplicación → Dominio
```

La dirección que se debe evitar es:

```text
Dominio → MongoDB / NestJS / HTTP
```

### Qué decir

> El dominio no sabe que existe MongoDB, un endpoint REST o un framework. En cambio, la infraestructura sí conoce al dominio porque necesita adaptar datos y llamadas externas a las reglas internas.

---

## Diapositiva 4: responsabilidad de cada capa

| Capa | Responsabilidad | Ejemplos en el proyecto |
| --- | --- | --- |
| Dominio | Define reglas y conceptos del negocio | `Reservation`, `ParkingSlot`, políticas, errores y enums |
| Aplicación | Coordina una acción concreta del sistema | `CreateReservationUseCase`, `RegisterPaymentUseCase` |
| Puertos | Define contratos entre el core y el exterior | `ReservationRepositoryPort`, `ClockPort`, `RealtimeNotifierPort` |
| Adaptadores de entrada | Convierte solicitudes externas en llamadas a casos de uso | controladores HTTP, gateway WebSocket, scheduler |
| Adaptadores de salida | Implementa servicios externos solicitados por el core | repositorios MongoDB, JWT, bcrypt, pagos y QR |
| Bootstrap | Conecta interfaces con implementaciones | módulos de NestJS e inyección de dependencias |

### Qué decir

> Cada capa responde una pregunta distinta: el dominio responde qué reglas existen; la aplicación, qué acciones se ejecutan; los adaptadores, cómo nos comunicamos con el exterior; y bootstrap, qué implementaciones concretas se conectan.

---

## Diapositiva 5: ejemplo completo — crear una reserva

La creación de una reserva muestra la separación de responsabilidades.

```text
Cliente
  ↓ POST /reservations
ReservationsController
  ↓ CreateReservationPort
CreateReservationUseCase
  ↓ políticas y puertos de salida
MongoReservationRepository / RealtimeNotifierAdapter
  ↓
MongoDB / clientes WebSocket
```

### 1. La petición del cliente

```http
POST /reservations
Authorization: Bearer <token>

{
  "branchId": "branch-1",
  "slotType": "CAR"
}
```

### 2. El controlador HTTP

`ReservationsController` recibe la solicitud. Sus responsabilidades son:

- Verificar la autenticación con `JwtAuthGuard`.
- Obtener el usuario autenticado mediante `@CurrentUser()`.
- Recibir los datos de `CreateReservationDto`.
- Transformar la petición a la entrada del caso de uso.
- Invocar `CreateReservationPort`.

El controlador no asigna espacios ni consulta MongoDB directamente.

```ts
return this.createReservation.execute({
  userId: user.sub,
  branchId: dto.branchId,
  slotType: dto.slotType,
  startAt: dto.startAt ? new Date(dto.startAt) : undefined,
});
```

### 3. El caso de uso

`CreateReservationUseCase` aplica las reglas del negocio:

1. Verifica si el usuario puede crear una reserva.
2. Consulta la política para asignar un espacio disponible.
3. Si no hay disponibilidad, lanza `NoAvailabilityError`.
4. Si el usuario ya tiene una reserva activa, lanza `ReservationAlreadyActiveError`.
5. Si existe una sede alternativa, devuelve una sugerencia.
6. Calcula la fecha de expiración.
7. Solicita persistir la reserva mediante un puerto.
8. Emite notificaciones de tiempo real.

Los posibles resultados son:

| Resultado | Comportamiento |
| --- | --- |
| Hay espacio disponible | Crea la reserva |
| No hay espacio | Devuelve un error de falta de disponibilidad |
| Hay otra sede disponible | Sugiere otra sede y su distancia |
| El usuario tiene reserva activa | Devuelve un error de regla de negocio |

### 4. Uso de abstracciones

El caso de uso no llama directamente a MongoDB. En su lugar depende de contratos:

```text
CreateReservationUseCase
    ↓
ReservationRepositoryPort
    ↓
MongoReservationRepository
    ↓
MongoDB
```

También usa otros puertos:

- `ClockPort`: obtiene la hora actual de forma reemplazable y fácil de probar.
- `RealtimeNotifierPort`: avisa eventos sin conocer WebSocket.
- Políticas de reserva y asignación: concentran reglas específicas del negocio.

### 5. Persistencia en MongoDB

`MongoReservationRepository` implementa el puerto de repositorio y guarda un documento como este:

```json
{
  "_id": "uuid-de-la-reserva",
  "userId": "user-1",
  "branchId": "branch-1",
  "slotId": "slot-A12",
  "requestedType": "CAR",
  "status": "PENDING",
  "startAt": "2026-08-12T10:00:00.000Z",
  "expiresAt": "2026-08-12T10:15:00.000Z"
}
```

El adaptador traduce `_id`, propio de MongoDB, a `id`, propio de la entidad de dominio. De esta manera, detalles de MongoDB no llegan al core.

### 6. Notificaciones

Después de crear la reserva, el caso de uso notifica:

- Que se creó una reserva.
- Que el espacio cambió a estado `RESERVADA`.
- Que la ocupación de la sede se actualizó.

La lógica conoce la necesidad de notificar, pero no conoce detalles de WebSocket.

### Qué decir

> Crear una reserva no es solo insertar una fila o un documento. Es un proceso de negocio: validar al usuario, buscar disponibilidad, aplicar reglas, calcular la expiración, persistir y notificar. El caso de uso centraliza este proceso sin acoplarse a HTTP, MongoDB ni WebSocket.

---

## Diapositiva 6: puertos y adaptadores

Los puertos son interfaces o contratos definidos por el core.

Hay dos clases:

| Tipo | Propósito | Ejemplo |
| --- | --- | --- |
| Puerto de entrada | Expone una acción que puede iniciar el exterior | `CreateReservationPort` |
| Puerto de salida | Declara una necesidad del core hacia el exterior | `ReservationRepositoryPort` |

Los adaptadores implementan o consumen esos puertos:

```text
Adaptador de entrada                 Core                    Adaptador de salida
ReservationsController → CreateReservationPort → ReservationRepositoryPort → MongoReservationRepository
```

### Qué decir

> El caso de uso dice “necesito guardar una reserva”; no dice “ejecuta una consulta MongoDB”. De esa forma, la tecnología queda fuera de la decisión de negocio.

---

## Diapositiva 7: bootstrap e inversión de dependencias

`bootstrap` es el punto de composición de la aplicación. Allí NestJS conecta cada puerto con un adaptador concreto.

Ejemplos reales de la configuración:

```text
USER_REPOSITORY              → MongoUserRepository
BRANCH_REPOSITORY            → MongoBranchRepository
PARKING_SLOT_REPOSITORY      → MongoParkingSlotRepository
RESERVATION_REPOSITORY       → MongoReservationRepository
PARKING_SESSION_REPOSITORY   → MongoParkingSessionRepository
PAYMENT_REPOSITORY           → MongoPaymentRepository

TOKEN_SERVICE                → JwtTokenAdapter
PASSWORD_HASHER              → BcryptPasswordHasherAdapter
CLOCK                        → SystemClockAdapter
```

### Qué decir

> Esta es la inversión de dependencias. El core declara qué necesita mediante interfaces y tokens. El módulo de arranque decide qué implementación real se entrega: MongoDB, JWT, bcrypt o cualquier otra alternativa.

---

## Diapositiva 8: cómo queda la distribución en Clean Architecture estricta

La distribución existente se puede expresar con nombres más cercanos a Clean Architecture:

```text
src/
├── domain/
│   ├── entities/
│   ├── policies/
│   └── errors/
├── application/
│   ├── use-cases/
│   └── ports/
├── infrastructure/
│   ├── http/
│   ├── persistence/mongodb/
│   ├── auth/
│   ├── payments/
│   ├── qr/
│   └── realtime/
└── main/
    └── bootstrap/
```

La correspondencia sería:

| Estructura actual | Distribución Clean Architecture |
| --- | --- |
| `core/domain` | `domain` |
| `core/application` y `core/ports` | `application` |
| `adapters/in` y `adapters/out` | `infrastructure` o interface adapters |
| `bootstrap` | `main` o composition root |

> No es obligatorio renombrar carpetas para aplicar Clean Architecture. Lo importante es respetar la dirección de dependencias y las responsabilidades de cada capa.

---

## Diapositiva 9: mejora pendiente para ser estrictamente Clean

La arquitectura actual ya protege al dominio de MongoDB y de los controladores. Sin embargo, los casos de uso importan decoradores de NestJS, como `@Injectable()` y `@Inject()`.

Esto genera un acoplamiento menor, pero real, entre la capa de aplicación y el framework.

Para una versión estricta:

```text
Dominio y aplicación     → TypeScript puro, sin NestJS
Infraestructura          → NestJS, MongoDB, HTTP, JWT y WebSocket
Bootstrap                → crea y conecta las dependencias
```

El caso de uso podría recibir sus dependencias por constructor sin decoradores de NestJS. Después, `bootstrap` o un módulo de infraestructura lo registraría en el contenedor de Nest.

### Beneficio

El caso de uso se puede reutilizar o probar incluso sin instalar o ejecutar NestJS.

---

## Diapositiva 10: beneficios del cambio

| Beneficio | Ejemplo en el proyecto |
| --- | --- |
| Pruebas más sencillas | Probar `CreateReservationUseCase` con repositorios y reloj falsos, sin MongoDB ni NestJS |
| Cambio de tecnología aislado | Implementar `PostgresReservationRepository` sin modificar casos de uso |
| Reutilización de reglas | REST, WebSocket, scheduler o una cola pueden invocar el mismo caso de uso |
| Menor acoplamiento | El core depende de puertos, no de drivers o frameworks |
| Mantenimiento | Cada cambio tiene una ubicación clara según su responsabilidad |

### Qué decir

> Si mañana se cambia MongoDB por PostgreSQL, o REST por GraphQL, no se reescriben las reglas de reservas. Solo se cambia o añade el adaptador que conecta con la nueva tecnología.

---

## Diapositiva 11: cambio de persistencia como ejemplo

El proyecto usa MongoDB como adaptador de salida. La capa de aplicación no cambia por esa decisión.

```text
Antes
CreateReservationUseCase → ReservationRepositoryPort → Prisma/PostgreSQL adapter

Ahora
CreateReservationUseCase → ReservationRepositoryPort → MongoReservationRepository

Futuro posible
CreateReservationUseCase → ReservationRepositoryPort → PostgresReservationRepository
```

### Qué decir

> El cambio de base de datos queda localizado. Solo cambia el adaptador que implementa el puerto. El caso de uso y sus reglas de negocio se conservan.

---

## Conclusión para exponer

> El backend ya aplica los principios principales de arquitectura hexagonal: el negocio está en el core, los puertos definen contratos y los adaptadores conectan servicios externos. Esta organización se alinea con Clean Architecture porque las dependencias apuntan hacia el dominio. Para llegar a una versión estricta, el siguiente paso es eliminar las dependencias de NestJS dentro de los casos de uso y dejar el framework únicamente en infraestructura y bootstrap.

## Frases breves para preguntas del profesor

**¿Por qué usar puertos si solo hay una base de datos?**  
Porque el objetivo no es anticipar todos los cambios, sino evitar que una regla de negocio dependa de una tecnología concreta y facilitar las pruebas.

**¿Cuál es la diferencia entre arquitectura hexagonal y Clean Architecture?**  
Ambas protegen el negocio mediante inversión de dependencias. La hexagonal enfatiza puertos y adaptadores; Clean Architecture enfatiza capas concéntricas y la regla de que las dependencias apuntan hacia adentro.

**¿Dónde se ubica NestJS?**  
NestJS pertenece a la capa externa: HTTP, módulos, guards, WebSocket e inyección de dependencias. No debería definir las reglas de negocio.

**¿Por qué el controlador no llama a MongoDB?**  
Porque un controlador solo adapta HTTP. Si accediera directamente a la base de datos, mezclaría interfaz, persistencia y negocio en una misma capa.

**¿Qué se modifica al cambiar MongoDB por PostgreSQL?**  
Se crea un adaptador de repositorio para PostgreSQL y se conecta en bootstrap. Los casos de uso deben mantenerse.
