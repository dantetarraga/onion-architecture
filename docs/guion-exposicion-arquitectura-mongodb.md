# Guion de exposición: arquitectura hexagonal y MongoDB

## Introducción

> Este proyecto usa arquitectura hexagonal. La idea es que la lógica del negocio esté en el centro y no dependa de frameworks, HTTP ni de la base de datos.

```text
backend/src
├── core/                    # Núcleo del negocio: no depende de Nest ni MongoDB
│   ├── domain/              # Entidades, reglas, políticas y errores
│   ├── application/         # Casos de uso
│   └── ports/               # Contratos de entrada y salida
│
├── adapters/                # Implementaciones para comunicarse con el exterior
│   ├── in/                  # Entradas: HTTP, WebSocket, scheduler
│   └── out/                 # Salidas: MongoDB, JWT, bcrypt, QR, pagos
│
└── bootstrap/               # Ensambla e inicia la aplicación NestJS
    ├── app.module.ts
    ├── repositories.module.ts
    └── módulos por funcionalidad
```

## 1. El centro: `core/`

> Primero tenemos el `core`, que es la parte más importante. Aquí está la lógica del negocio y no debería saber si usamos MongoDB, PostgreSQL o una API externa.

- `core/domain/entities`: entidades como `User`, `Reservation`, `ParkingSlot` y `Payment`.
- `core/domain/policies`: reglas de negocio; por ejemplo, cómo asignar un espacio o calcular precios.
- `core/application/use-cases`: acciones del sistema: crear reserva, registrar entrada y registrar pago.
- `core/ports`: contratos que separan el negocio del exterior.

> Por ejemplo, un caso de uso puede pedir “guardar una reserva”, pero no sabe en qué base de datos se guardará.

## 2. Puertos: los contratos

> Los puertos son interfaces. Funcionan como acuerdos entre el core y los adaptadores.

```text
Caso de uso
    ↓
ReservationRepositoryPort
    ↓
MongoReservationRepository
    ↓
MongoDB
```

> Así el caso de uso depende de una abstracción, `ReservationRepositoryPort`, y no de MongoDB directamente.

Hay dos tipos de puertos:

- `ports/in`: contratos de los casos de uso que puede invocar una entrada, como un controlador HTTP.
- `ports/out`: contratos para salir del core, como repositorios, JWT, hash de contraseña o notificaciones.

## 3. Adaptadores de entrada: `adapters/in/`

> Los adaptadores de entrada reciben solicitudes externas y llaman a los casos de uso.

```text
adapters/in/
├── http/
│   ├── controllers/   # Endpoints REST
│   ├── dto/           # Validación de datos recibidos
│   ├── guards/        # Autenticación y roles
│   └── filters/       # Manejo de errores
├── websocket/         # Eventos en tiempo real
└── scheduler/         # Tareas programadas
```

> Por ejemplo, `reservations.controller.ts` recibe una petición HTTP, valida el DTO y ejecuta el caso de uso. El controlador no contiene la lógica de negocio ni consultas a base de datos.

## 4. Adaptadores de salida: `adapters/out/`

> Los adaptadores de salida permiten que el core se comunique con servicios externos.

```text
adapters/out/
├── auth/              # bcrypt y JWT
├── clock/             # Hora del sistema
├── payments/          # Implementaciones de medios de pago
├── qr/                # Generación de códigos QR
├── realtime/          # Notificaciones WebSocket
└── persistence/
    └── mongodb/       # Implementación de persistencia actual
```

> Esta división permite reemplazar una tecnología sin reescribir los casos de uso.

## 5. Adaptador MongoDB

```text
adapters/out/persistence/mongodb/
├── mongo.module.ts
├── mongo.service.ts
├── mongo-docs.ts
├── mongo-docs.spec.ts
├── seed-users.ts
└── repositories/
    ├── mongo-user.repository.ts
    ├── mongo-branch.repository.ts
    ├── mongo-parking-slot.repository.ts
    ├── mongo-reservation.repository.ts
    ├── mongo-parking-session.repository.ts
    └── mongo-payment.repository.ts
```

### `mongo.module.ts`

> Este módulo registra el servicio de MongoDB dentro de NestJS. Gracias a ello, otros adaptadores pueden inyectar una conexión a la base de datos.

### `mongo.service.ts`

> Este archivo concentra la conexión técnica con MongoDB.

Realiza estas tareas:

1. Lee `MONGODB_URI` y `MONGODB_DB`.
2. Crea un `MongoClient`.
3. Se conecta al iniciar la aplicación.
4. Expone `getCollection()` para que los repositorios obtengan colecciones.
5. Cierra la conexión al apagar la aplicación.
6. Crea datos demo iniciales.

> También crea un índice único para `users.email`, para no permitir correos repetidos.

### `mongo-docs.ts`

> MongoDB usa el campo `_id`, mientras que las entidades del dominio usan `id`. Este archivo traduce entre ambos modelos.

```text
Documento MongoDB          Entidad de dominio
_id: "user-1"       →      id: "user-1"
```

> Es una capa pequeña, pero importante: evita que `_id` de MongoDB llegue al core.

## 6. Repositorios y colecciones MongoDB

> Cada repositorio implementa uno de los puertos de salida definidos en `core/ports/out`.

| Repositorio | Colección | Datos y relaciones principales |
| --- | --- | --- |
| `MongoUserRepository` | `users` | `_id`, `email`, `passwordHash`, `fullName`, `role`, `createdAt` |
| `MongoBranchRepository` | `branches` | `_id`, `name`, `address`, `lat`, `lng`, `pricePerHour` |
| `MongoParkingSlotRepository` | `parkingSlots` | `branchId`, `code`, `type`, `status` |
| `MongoReservationRepository` | `reservations` | `userId`, `branchId`, `slotId`, `status`, `startAt`, `expiresAt` |
| `MongoParkingSessionRepository` | `parkingSessions` | `reservationId`, `userId`, `slotId`, `status`, `entryAt`, `exitAt` |
| `MongoPaymentRepository` | `payments` | `sessionId`, `userId`, `amount`, `status`, `paidAt` |

> Por ejemplo, `MongoReservationRepository` implementa acciones como crear, buscar, listar y actualizar reservas. Para el caso de uso, sigue siendo simplemente un repositorio de reservas; no necesita saber que internamente hay documentos MongoDB.

Las relaciones ya no son llaves foráneas de PostgreSQL: se guardan como IDs (`userId`, `branchId`, `slotId`, etc.) y los repositorios las consultan cuando lo requieren. Se usan IDs tipo `string` o UUID, no `ObjectId`.

## 7. Ensamblaje: `bootstrap/`

> Finalmente, `bootstrap` une todas las piezas usando NestJS.

- `app.module.ts` importa `MongoModule`, módulos de casos de uso y demás módulos técnicos.
- `repositories.module.ts` hace la inyección de dependencias.
- Los módulos como `auth.module.ts`, `reservations.module.ts` o `parking.module.ts` registran sus casos de uso.

La parte clave es esta equivalencia:

```text
USER_REPOSITORY              → MongoUserRepository
BRANCH_REPOSITORY            → MongoBranchRepository
PARKING_SLOT_REPOSITORY      → MongoParkingSlotRepository
RESERVATION_REPOSITORY       → MongoReservationRepository
PARKING_SESSION_REPOSITORY   → MongoParkingSessionRepository
PAYMENT_REPOSITORY           → MongoPaymentRepository
```

> Esta es la parte que demuestra la inversión de dependencias: el core pide un puerto y el bootstrap decide qué adaptador concreto usar.

## 8. Cambio de base de datos y demostración

> Antes la aplicación usaba PostgreSQL con Prisma, migraciones SQL y un esquema relacional. Ahora usa MongoDB con el driver nativo.

- Se retiraron Prisma, su esquema y sus migraciones SQL.
- La conexión ahora usa `MONGODB_URI` y `MONGODB_DB`.
- Docker levanta un servicio `mongo` y el backend espera su verificación de salud.
- No existe una migración de datos desde PostgreSQL: el adaptador inicializa datos demo en MongoDB.

Para mostrar las colecciones durante una demo:

```bash
docker compose up --build
```

En otra terminal:

```bash
mongosh mongodb://localhost:27017/parking
show collections
db.users.find()
db.branches.find()
db.parkingSlots.find()
```

## Cierre

> En resumen, MongoDB está aislado en `adapters/out/persistence/mongodb`. El dominio y los casos de uso no dependen de MongoDB. Si mañana cambiamos de base de datos, crearíamos otro adaptador que implemente los mismos puertos; la lógica central del sistema se conserva.
