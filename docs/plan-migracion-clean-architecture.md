# De Hexagonal a Clean Architecture — plan de migración (solo carpetas, sin código)

Este documento es la continuación natural de `docs/arquitectura-hexagonal.md`.
No migra nada todavía: es el **mapa de carpetas** (qué se mueve, a dónde, y
por qué) para cuando se decida hacer el tercer refactor puramente
estructural: Onion → Hexagonal (ya hecho, rama `refactor/hexagonal-architecture`)
→ **Clean Architecture** (Robert C. Martin, "The Clean Architecture", 2012).

## 0. Resumen de las tres convenciones

| # | Rama | Convención | Idea organizadora |
|---|------|------------|--------------------|
| 1 | `main` | Onion | Anillos por **capa técnica**: `domain → application → infrastructure/presentation` |
| 2 | `refactor/hexagonal-architecture` | Hexagonal (Ports & Adapters) | Un solo borde núcleo/exterior; los adaptadores se agrupan por **dirección** (`in`/`out`) |
| 3 | *(futura)* `refactor/clean-architecture` | Clean Architecture | 4 anillos concéntricos por **distancia a las reglas de negocio**, con la Dependency Rule explícita: las flechas de código siempre apuntan hacia adentro |

Las tres imponen la misma regla de fondo (el dominio no conoce el framework),
solo cambia el criterio de agrupación de carpetas. Ese es justamente el punto
didáctico de la serie.

## 1. Los 4 anillos de Clean Architecture (Uncle Bob) aplicados a este dominio

```
                 ┌─────────────────────────────────────────┐
                 │  Frameworks & Drivers                    │  Nest, Prisma (driver),
                 │  (bootstrap/, prisma/, main.ts, Docker)  │  Express, Swagger, WS server
                 │   ┌───────────────────────────────────┐ │
                 │   │  Interface Adapters               │ │  Controllers, DTOs, Gateways
                 │   │  (controllers, repositorios,       │ │  (implementaciones que
                 │   │   presenters, mappers)             │ │  traducen entidad <-> tabla,
                 │   │   ┌─────────────────────────────┐ │ │  entidad <-> JSON, etc.)
                 │   │   │  Use Cases                   │ │ │  Interactors + Boundaries
                 │   │   │  (application business rules)│ │ │  (input/output ports)
                 │   │   │   ┌───────────────────────┐ │ │ │ │
                 │   │   │   │  Entities              │ │ │ │ │  Branch, ParkingSlot,
                 │   │   │   │  (enterprise business  │ │ │ │ │  Reservation, Payment...
                 │   │   │   │   rules + policies)    │ │ │ │ │  + las 5 policies
                 │   │   │   └───────────────────────┘ │ │ │ │
                 │   │   └─────────────────────────────┘ │ │
                 │   └───────────────────────────────────┘ │
                 └─────────────────────────────────────────┘
```

La Dependency Rule: el código fuente de un anillo solo puede nombrar cosas de
anillos más internos (o interfaces internas), nunca de anillos más externos.
Es la misma regla que ya cumple `core/domain` en la rama hexagonal (cero
imports de NestJS/Prisma) — Clean Architecture la hace explícita para **cada**
frontera, no solo para el dominio.

## 2. Tabla de mapeo: Hexagonal (actual) → Clean Architecture (propuesta)

| Carpeta hexagonal actual | Contenido | Anillo Clean destino | Carpeta propuesta |
|---|---|---|---|
| `core/domain/entities/` | Branch, ParkingSlot, ParkingSession, Reservation, Payment, User | **Entities** | `entities/models/` |
| `core/domain/enums/` | Enums de dominio | **Entities** | `entities/enums/` |
| `core/domain/errors/` | DomainError y subclases | **Entities** | `entities/errors/` |
| `core/domain/policies/` (+ `impl/`) | Reglas de negocio intercambiables (Strategy) | **Entities** | `entities/policies/` |
| `core/application/use-cases/` | Un caso de uso = una operación de negocio | **Use Cases** | `use-cases/{auth,admin,branches,parking,payments,reservations,users}/` |
| `core/application/shared/` | Helpers de casos de uso (`occupancy-level.ts`) | **Use Cases** | `use-cases/shared/` |
| `core/ports/in/` | Interfaces que el núcleo expone (boundary de entrada) | **Use Cases** (boundary) | `use-cases/ports/in/` — sigue siendo el contrato del interactor, no un adaptador |
| `core/ports/out/` | Interfaces que el núcleo necesita (boundary de salida) | **Use Cases** (boundary) | `use-cases/ports/out/` — la *interfaz* del Gateway vive junto al caso de uso que la declara, no junto a quien la implementa |
| `adapters/in/http/controllers/` | Controllers HTTP | **Interface Adapters** | `interface-adapters/controllers/http/` |
| `adapters/in/http/dto/` | DTOs de request/response | **Interface Adapters** | `interface-adapters/controllers/http/dto/` |
| `adapters/in/http/guards/`, `decorators/`, `filters/` | Infra transversal de Nest ligada al controller | **Interface Adapters** | `interface-adapters/controllers/http/{guards,decorators,filters}/` |
| `adapters/in/websocket/` (mitad `join`/`leave`) | Traduce mensajes de socket entrantes a llamadas al núcleo | **Interface Adapters** | `interface-adapters/controllers/websocket/` |
| `adapters/in/scheduler/` | Traduce el disparo del cron a una llamada al núcleo | **Interface Adapters** | `interface-adapters/controllers/scheduler/` |
| `adapters/out/persistence/prisma/repositories/` | Implementan `*.repository.port.ts` | **Interface Adapters** | `interface-adapters/gateways/persistence/repositories/` |
| `adapters/out/persistence/prisma/mappers/` | Entidad <-> fila de Prisma | **Interface Adapters** | `interface-adapters/gateways/persistence/mappers/` |
| `adapters/out/auth/` (bcrypt, jwt) | Implementan `PasswordHasherPort`, `TokenPort` | **Interface Adapters** | `interface-adapters/gateways/auth/` |
| `adapters/out/qr/` | Implementa `QrCodePort` | **Interface Adapters** | `interface-adapters/gateways/qr/` |
| `adapters/out/payments/` | Implementan `PaymentMethod` (Strategy + Router) | **Interface Adapters** | `interface-adapters/gateways/payments/` |
| `adapters/out/clock/` | Implementa `ClockPort` | **Interface Adapters** | `interface-adapters/gateways/clock/` |
| `adapters/out/realtime/` | Implementa `RealtimeNotifierPort`, empuja a sockets | **Interface Adapters** | `interface-adapters/gateways/realtime/` |
| `adapters/out/persistence/prisma/prisma.service.ts`, `prisma.module.ts` | Cliente Prisma en sí (el *driver*) | **Frameworks & Drivers** | `frameworks-drivers/database/prisma/` |
| `prisma/schema.prisma`, migraciones | Esquema y motor de BD | **Frameworks & Drivers** | `frameworks-drivers/database/prisma/schema.prisma` (o se deja en `prisma/` a nivel raíz, es común dejarlo fuera de `src/`) |
| `bootstrap/*.module.ts`, `main.ts`, `app.module.ts` | Composition root, wiring de DI, arranque de Nest | **Frameworks & Drivers** | `frameworks-drivers/bootstrap/` |
| `Dockerfile`, `docker-compose.yml`, Swagger config | Infra de despliegue/documentación | **Frameworks & Drivers** | sin cambios (ya son "afuera de todo") |

## 3. Las dos decisiones de juicio que esta migración obliga a tomar

Igual que el doc hexagonal tuvo su sección 4 de "decisiones que no se derivan
mecánicamente", esta migración tiene dos puntos donde Ports & Adapters y
Clean Architecture **no calzan 1:1**, y hay que decidir a propósito:

1. **Los puertos `out` (`*.repository.port.ts`, `clock.port.ts`, etc.) dejan
   de vivir junto a los adaptadores que los implementan.** En hexagonal,
   `ports/out/` y `adapters/out/` son casi vecinos conceptuales (mismo
   "lado" del hexágono). En Clean Architecture, la *interfaz* de un Gateway
   pertenece al anillo **Use Cases** (es el caso de uso quien decide qué
   necesita del exterior — Dependency Inversion clásico), y la
   *implementación* pertenece al anillo **Interface Adapters**, un anillo
   entero de distancia más afuera. Es el cambio de carpeta más importante de
   los tres refactors: separa físicamente contrato e implementación en vez
   de solo agruparlos por `in`/`out`.

2. **Los repositorios Prisma (`adapters/out/persistence/prisma/repositories/`)
   son Interface Adapters, no Frameworks & Drivers**, aunque "hablan
   Prisma". La distinción de Uncle Bob es: el *driver* de base de datos
   (`PrismaService`, el cliente generado, el `schema.prisma`) es
   Frameworks & Drivers; el código que traduce entre `Reservation` (entidad)
   y una fila/objeto de Prisma es un **Gateway**, y los Gateways son
   Interface Adapters. Esto es lo mismo que ya se decidió para
   `realtime-notifier.adapter.ts` en el doc hexagonal (sección 4, punto 3),
   solo que ahora la frontera tiene nombre propio en vez de ser "out".

   Las **policies de dominio** (`SlotAssignmentPolicy`, `PricingPolicy`,
   `ReservationPolicy`, `ParkingPolicy`) siguen la misma lógica que ya se
   documentó en hexagonal: nunca cruzan hacia infraestructura real, así que
   se quedan en el anillo más interno (**Entities**) junto con las
   entidades, no en Use Cases ni en Interface Adapters.

## 4. Ejemplo de flujo (mismo caso que en el doc hexagonal, reescrito para Clean)

`POST /reservations`:

```
interface-adapters/controllers/http/reservations.controller.ts   (Interface Adapters)
  -> use-cases/ports/in/reservations/create-reservation.port.ts   (boundary, anillo Use Cases)
    -> use-cases/reservations/create-reservation.use-case.ts      (Use Cases)
      -> entities/policies/reservation.policy.ts                  (Entities, regla interna)
      -> entities/policies/slot-assignment.policy.ts              (Entities, regla interna)
      -> use-cases/ports/out/reservation.repository.port.ts       (boundary, anillo Use Cases)
        -> interface-adapters/gateways/persistence/repositories/prisma-reservation.repository.ts (Interface Adapters)
          -> frameworks-drivers/database/prisma/prisma.service.ts (Frameworks & Drivers)
      -> use-cases/ports/out/realtime-notifier.port.ts             (boundary, anillo Use Cases)
        -> interface-adapters/gateways/realtime/realtime-notifier.adapter.ts (Interface Adapters)
```

Comparado con el flujo hexagonal equivalente (doc anterior, sección 5), la
diferencia visible es que el puerto ya no está "pegado" a su adaptador de
salida (`ports/out/` + `adapters/out/` en la misma altura) — ahora hay un
anillo completo (Interface Adapters) entre el boundary (`use-cases/ports/out/`)
y el driver real (`frameworks-drivers/`). El repositorio Prisma queda en medio
de los dos, como Gateway.

## 5. Qué NO cambiaría (igual que en el refactor Onion → Hexagonal)

- Cero cambios de comportamiento: seguiría siendo `git mv` + reescritura de
  imports + (si se formaliza del todo) separar cada `*.port.ts` de `out/` en
  su propio archivo de interfaz dentro de `use-cases/ports/out/`, sin tocar
  la lógica de ningún caso de uso, policy o entidad.
- Los 45 tests unitarios existentes no deberían requerir cambios de
  aserciones, solo de rutas de import.
- Prisma, JWT, HMAC QR, WebSocket, scheduler: mismas librerías, se reubican
  una vez más según a qué anillo pertenecen, no según su tecnología.
- `nest-cli.json#entryFile`, `Dockerfile` y `docker-compose.yml` tendrían que
  actualizar la ruta de `main.ts` otra vez (de `bootstrap/main` a
  `frameworks-drivers/bootstrap/main`), igual que se hizo en el paso anterior.

## 6. Alcance de este documento

Este archivo es **solo el plan de carpetas**. A propósito no incluye:
- Ejecución del `git mv` ni el refactor de imports.
- Creación de la rama `refactor/clean-architecture`.
- Cambios en `nest-cli.json`, `Dockerfile`, `docker-compose.yml`.

Eso queda para cuando se decida ejecutar la migración; este documento es la
referencia de "qué va a dónde y por qué" para ese momento.
