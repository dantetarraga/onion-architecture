# Plan de implementación — Integrante 2 (Sucursales, Acceso y Estacionamiento)

> Documento vivo. Se actualiza marcando checkboxes y anotando decisiones a medida que se avanza. Sirve como memoria de contexto entre sesiones de trabajo.

- **Proyecto:** Sistema Inteligente de Gestión de Estacionamientos
- **Documento base:** `documento-implementacion-v2.docx` (raíz de `practica2`)
- **Responsable de este plan:** Integrante 2
- **Última actualización:** 2026-07-22
- **Repo:** `onion-architecture/` — `backend/` (NestJS + TS + Prisma + PostgreSQL) y `frontend/` (React)

---

## 1. Visión del proyecto (resumen ejecutivo)

Un sistema de estacionamiento multi-sucursal donde **el usuario nunca elige la cochera**: el sistema decide automáticamente qué cochera asignar, cuánto cobrar, cuándo expira una reserva y cómo resolver un pago, siguiendo políticas de negocio. La razón de ser del proyecto (sección 13 del doc base) es demostrar que, con Onion Architecture, esas reglas pueden **evolucionar sin tocar infraestructura**: cambiar de "primera cochera disponible" a otra estrategia, o de un pago mock a una pasarela real, debe ser un cambio aislado en una sola capa.

El stack real difiere del propuesto en el documento (Java/Spring → NestJS/TypeScript/Prisma), pero los **principios de Onion se respetan igual o más estrictamente**: el dominio no importa nada de Nest, Prisma ni Express.

### Mapeo de capas → carpetas reales del repo

```
src/domain/          → Núcleo. Entidades, enums, políticas (interfaces), errores, puertos (interfaces de repos/servicios).
                        CERO imports de @nestjs/*, @prisma/*, class-validator, etc.
src/application/     → Casos de uso. Orquestan políticas + repos vía los puertos del dominio. Define sus propios puertos
                        (clock, qr, realtime, token, password-hasher) para servicios que no son "repositorios" pero
                        tampoco son reglas de negocio.
src/infrastructure/  → Adapters concretos: Prisma repos, JWT, HMAC QR, WebSocket gateway, scheduler, mocks de pago.
                        Implementa las interfaces (puertos) definidas en domain/ y application/ports.
src/presentation/    → Controllers REST, DTOs (class-validator), guards, filtro de excepciones de dominio → HTTP status.
src/modules/         → Wiring de NestJS (DI) por feature. src/infrastructure/modules/policies.module.ts es donde se
                        elige QUÉ implementación concreta de cada política se inyecta (el punto de "swap" de Onion).
```

**Regla de dependencia (no negociable):** `presentation → application → domain ← infrastructure`. El dominio no depende de nada. Si una clase en `domain/` necesita importar algo de `infrastructure/` o de una librería externa (Nest, Prisma, dayjs, etc.), es señal de que está mal ubicada.

---

## 2. Estado actual (ya implementado, verificado leyendo el código)

| Pieza | Archivo(s) | Estado |
|---|---|---|
| Entidades `Branch`, `ParkingSlot`, `ParkingSession` | `domain/entities/*.ts` | ✅ Limpias, sin decoradores de framework |
| `Branch.distanceKmTo()` (Haversine) | `domain/entities/branch.entity.ts` | ✅ |
| Política 1 (asignación + fallback cross-sucursal) | `domain/policies/impl/default-slot-assignment.policy.ts` | ✅ + test unitario |
| Políticas 5/6 (ingreso/salida, estados de cochera) | `domain/policies/impl/default-parking.policy.ts` | ✅ |
| QR firmado HMAC (TTL 15 min) | `infrastructure/qr/hmac-qrcode.adapter.ts` | ✅ |
| WebSocket con salas por sucursal + admin | `infrastructure/websocket/events.gateway.ts`, `realtime-notifier.adapter.ts` | ✅ Cubre los 8 eventos de la sección 8 del doc |
| 3 sucursales sembradas (Miraflores, San Borja, San Isidro) | `prisma/seed.ts` | ✅ (verificado contra Postgres real, cumple el "3 sucursales" que se pidió) |
| Reclamo atómico de cochera (`FOR UPDATE SKIP LOCKED`) | `infrastructure/persistence/prisma/repositories/prisma-parking-slot.repository.ts` | ✅ Concurrencia ya resuelta |
| Confirmación de sucursal sugerida | `reservations.controller.ts` (`POST /reservations/confirm-suggestion`) | ✅ Reutiliza `CreateReservationUseCase`, por lo que **ya revalida disponibilidad en cascada** si la sucursal sugerida también se llenó mientras tanto. No requiere código nuevo, solo un test que lo pruebe explícitamente (ver E4). |
| `PaymentMethod` port (Gateway intercambiable) | `domain/policies/payment-method.port.ts` + `infrastructure/payments/mock-payment-method.adapter.ts` | ✅ Existe un único mock (siempre aprueba salvo monto ≤ 0) |

### Gaps reales detectados (no cosméticos, confirmados leyendo el código)

1. **`DefaultParkingPolicy.registerEntry` no verifica si ya existe una sesión activa para la reserva.** Si se re-escanea el mismo QR de entrada dentro de la ventana de 15 min (ej. el usuario abre la app dos veces, o alguien reenvía el link), se crea una **segunda `ParkingSession`** para la misma reserva/cochera. El repo ya expone `findByReservationId` — simplemente no se usa ahí. Es un bug de replay real, no hipotético.
2. **`RegisterExitUseCase` no recalcula el precio al momento real de salida.** `RegisterPaymentUseCase` calcula el monto con `now` en el momento del pago, pero si el usuario paga y luego se queda más tiempo, el pago ya registrado puede no cubrir la estadía real. Hoy `DefaultParkingPolicy.registerExit` solo valida `payment.isApproved()`, no si el monto sigue siendo suficiente.
3. Solo existe **una** implementación de `SlotAssignmentPolicy` — no hay nada que demuestre en vivo que la política es intercambiable (el argumento central de la sección 13 del documento).
4. Solo existe **un** método de pago (mock genérico). No hay Strategy para efectivo/tarjeta/Yape/Plin.

---

## 3. Alcance acordado para esta iteración

**Prioridad 1 — tu módulo oficial** (Sucursales, Acceso y Estacionamiento):
- E1. Política de asignación alternativa, intercambiable en runtime.
- E2. Corrección del replay de QR de entrada (regla de dominio, no hack de infraestructura).
- E3. Regla de sobre-estadía / pago insuficiente al salir.
- E4. Test + paso de demo explícito para la revalidación en cascada al confirmar sucursal sugerida.

**Prioridad 2 — absorbida por acuerdo del equipo** (oficialmente de Integrante 3, pero se decidió incluirla aquí):
- E5. Métodos de pago múltiples (efectivo, tarjeta, Yape, Plin) como Strategy, todos mockeados.

**Explícitamente fuera de alcance** (no tocar sin coordinar con el equipo):
- Promociones / convenios institucionales (SUNAT, clínicas, banco) → `PricingPolicy`, de Integrante 3.
- Scheduler de expiración, dashboard admin, reporte de ingresos → Integrante 3.
- Login/JWT/roles, `ReservationPolicy`, casos de uso de reservas (crear/cancelar/consultar) → Integrante 1. (Ojo: `CreateReservationUseCase` se **lee** porque coordina con `SlotAssignmentPolicy`, pero no se modifica.)

---

## 4. Escenarios a implementar

### E1 — Política de asignación alternativa e intercambiable (Strategy)

**Objetivo:** probar en vivo, durante la sustentación, que se puede cambiar el criterio de asignación sin tocar casos de uso, controllers ni infraestructura de persistencia — solo la capa de wiring.

**Regla de negocio nueva (`BalancedSlotAssignmentPolicy`):**
- Dentro de la sucursal elegida: en vez de tomar la primera cochera por código (orden actual), tomar la **menos usada recientemente** (`ORDER BY "updatedAt" ASC`) para repartir el desgaste físico entre cocheras.
- Para la sugerencia cross-sucursal: en vez de rankear solo por distancia (Haversine), usar un score compuesto `distancia_km + peso * nivel_ocupación`, para no mandar siempre al mismo vecino cercano si está casi lleno y hay otro un poco más lejos con más cupo.

**Archivos:**
- Nuevo: `domain/policies/impl/balanced-slot-assignment.policy.ts`
- Nuevo: `domain/policies/impl/balanced-slot-assignment.policy.spec.ts`
- Modificado: `domain/ports/parking-slot.repository.port.ts` → agregar `claimLeastRecentlyUsedSlot(branchId, type?): Promise<ParkingSlot | null>`
- Modificado: `infrastructure/persistence/prisma/repositories/prisma-parking-slot.repository.ts` → implementar el método nuevo (copiar `claimAvailableSlot` cambiando `ORDER BY "code" ASC` → `ORDER BY "updatedAt" ASC`)
- Modificado: `domain/policies/impl/default-slot-assignment.policy.spec.ts` → el mock de `ParkingSlotRepositoryPort` deja de estar completo si no se le agrega el método nuevo (`jest.Mocked<...>` fallará a compilar). **Actualizar ese mock aunque no se toque la lógica del test.**
- Modificado: `infrastructure/modules/policies.module.ts` → la factory de `SLOT_ASSIGNMENT_POLICY` lee `ConfigService.get('SLOT_ASSIGNMENT_STRATEGY')` (`default` | `balanced`, default `default`) y construye la clase correspondiente.
- Modificado: `.env` / `.env.example` → agregar `SLOT_ASSIGNMENT_STRATEGY=default`

**Criterio de aceptación:** cambiar solo la variable de entorno y reiniciar el backend cambia el comportamiento observable (qué cochera se asigna, qué sucursal se sugiere) sin recompilar otra cosa que el módulo de wiring. Sirve como demo en vivo de la sección 13 del doc.

- [x] Puerto `claimLeastRecentlyUsedSlot` agregado y probado (rama `feature/e1-balanced-slot-assignment-policy`)
- [x] `BalancedSlotAssignmentPolicy` implementada + spec (3 tests, todos verdes)
- [x] Swap por env var funcionando (`SLOT_ASSIGNMENT_STRATEGY=default|balanced` en `policies.module.ts` + `.env.example`)
- [x] Actualizado runbook con el paso de demo (`docs/demo-runbook.md`, sección 0 y 3)
- [x] Probado manualmente contra Postgres real: `docker compose -f backend/docker-compose.dev.yml up -d` → migrate → seed → `start:dev` con `SLOT_ASSIGNMENT_STRATEGY=default` (reserva creada, cancelada) y luego con `SLOT_ASSIGNMENT_STRATEGY=balanced` (SQL de `claimLeastRecentlyUsedSlot` con `FOR UPDATE SKIP LOCKED` y `::"SlotType"` ejecutado y verificado end-to-end contra la DB real, no solo mockeado)

**E1 — cerrado.** Nuevo archivo de apoyo: `backend/docker-compose.dev.yml` (Postgres standalone para desarrollo local, puerto 5434, separado del `docker-compose.yml` raíz que levanta el stack completo con builds de backend/frontend). Requiere `backend/.env` (gitignorado) con los mismos valores que `.env.example`.

---

### E2 — QR de entrada de un solo uso (anti-replay)

**Objetivo:** cerrar el bug real encontrado — cada reserva solo puede generar **una** sesión de ingreso activa.

**Dónde vive la regla:** en el dominio, en `DefaultParkingPolicy.registerEntry`, **no** en el adapter de QR (el HMAC ya cumple su función de integridad/expiración; el problema es de invariante de negocio: "una reserva no puede tener dos sesiones activas", no de criptografía).

**Cambio:**
```ts
// DefaultParkingPolicy.registerEntry, antes de crear la sesión:
const existing = await this.sessions.findByReservationId(reservation.id);
if (existing && existing.isActive()) {
  throw new SessionAlreadyActiveError(); // nuevo error de dominio
}
```

**Archivos:**
- Nuevo: `domain/errors/session-already-active.error.ts` (`code: 'SESSION_ALREADY_ACTIVE'`)
- Modificado: `domain/policies/impl/default-parking.policy.ts`
- Modificado: `presentation/http/filters/domain-exception.filter.ts` → agregar `SESSION_ALREADY_ACTIVE: HttpStatus.CONFLICT` al mapa `STATUS_BY_CODE`
- Nuevo/Modificado: spec de `DefaultParkingPolicy` (no existe `default-parking.policy.spec.ts` hoy — crearlo, cubriendo también los casos existentes de `registerExit` que hoy no tienen test)

**Criterio de aceptación:** escanear el mismo QR de entrada dos veces devuelve `409 SESSION_ALREADY_ACTIVE` la segunda vez, no crea una sesión duplicada.

- [x] Error de dominio agregado (`domain/errors/session-already-active.error.ts`)
- [x] Regla implementada en `DefaultParkingPolicy.registerEntry` (guard con `findByReservationId` antes de crear la sesión)
- [x] Filtro HTTP actualizado (`SESSION_ALREADY_ACTIVE` → 409)
- [x] Spec nuevo cubriendo entrada duplicada (`default-parking.policy.spec.ts`, 9 tests: `registerEntry` + `registerExit`, que antes no tenía cobertura)
- [x] Probado manualmente vía REST contra Postgres real (`docker compose -f docker-compose.dev.yml up -d` → migrate → seed → `start:dev`): login, crear reserva, obtener QR de entrada, `POST /parking/entry` dos veces con el mismo QR → primer escaneo `201` (sesión `ACTIVE`), segundo escaneo `409 SESSION_ALREADY_ACTIVE`; verificado en la tabla `parking_sessions` que solo existe una fila para la reserva

**E2 — cerrado.**

---

### E3 — Regla de sobre-estadía (pago insuficiente al salir)

**Objetivo:** si el usuario pagó pero se quedó más tiempo del que cubre su pago, no debe poder salir sin regularizar la diferencia.

**Dónde vive la regla:** el dominio explícitamente prohíbe que `ParkingPolicy` y `PricingPolicy` se llamen entre sí (frontera declarada en la sección 11 del doc: "el caso de uso coordina a ambas, ninguna política llama directamente a la otra"). Por lo tanto esta validación va en el **caso de uso** `RegisterExitUseCase`, no dentro de `DefaultParkingPolicy`.

**Flujo nuevo en `RegisterExitUseCase.execute`:**
1. Verificar QR y resolver `sessionId` (como hoy).
2. Buscar `session`, `reservation` y `payment` existente.
3. Recalcular `PricingPolicy.calculate({ ..., exitAt: now })` con el instante real de salida.
4. Si `payment.amount < recalculado.amount` (con tolerancia de centavos): lanzar `OverstayPaymentInsufficientError` con el monto faltante, **sin** llamar a `parkingPolicy.registerExit` (la cochera no se libera, la sesión sigue activa).
5. Si es suficiente, seguir el flujo actual.

**Archivos:**
- Nuevo: `domain/errors/overstay-payment-insufficient.error.ts` (`code: 'OVERSTAY_PAYMENT_INSUFFICIENT'`, incluir el faltante en el mensaje)
- Modificado: `application/use-cases/parking/register-exit.use-case.ts` → inyectar `PRICING_POLICY` y `PAYMENT_REPOSITORY` (tokens ya existen), agregar el paso 3-4
- Modificado: `presentation/http/filters/domain-exception.filter.ts` → `OVERSTAY_PAYMENT_INSUFFICIENT: HttpStatus.PAYMENT_REQUIRED` (402, semánticamente correcto)
- Nuevo: test del use case (`register-exit.use-case.spec.ts` si no existe) cubriendo el caso de sobre-estadía

**Nota de coordinación:** esto acopla tu caso de uso a `PricingPolicy` (de Integrante 3), pero solo a su **interfaz** (`domain/policies/pricing.policy.ts`), que ya existe y es estable. No es necesario que Integrante 3 haga nada para que esto funcione.

**Criterio de aceptación (demo):** pagar, esperar/forzar que pase el tiempo suficiente para que la tarifa suba (o bajar `pricePerHour`/manipular el reloj de prueba), intentar salir → `402 OVERSTAY_PAYMENT_INSUFFICIENT` con el monto pendiente. Registrar un pago adicional por la diferencia → la salida procede.

**Gap adicional encontrado al implementar (no estaba en el plan original):** el criterio de aceptación de "pagar la diferencia" no funcionaba con el `RegisterPaymentUseCase` tal como estaba — `payments.sessionId` es `@unique` en el schema (relación 1:1 sesión↔pago) y el use case hacía `return existingPayment` apenas encontraba un pago, sin intentar cobrar nada más. Se resolvió agregando `PaymentRepositoryPort.increaseAmount(id, additionalAmount, externalReference, paidAt)` (incrementa el monto del pago existente, lo marca `APPROVED` y concatena la nueva `externalReference` a la anterior para trazabilidad) y reescribiendo `RegisterPaymentUseCase` para recalcular la tarifa siempre y, si ya hay un pago pero es insuficiente, cobrar y sumar solo la diferencia (top-up) en vez de devolver el pago viejo tal cual.

- [x] Error de dominio agregado (`domain/errors/overstay-payment-insufficient.error.ts`, incluye `missingAmount`)
- [x] `RegisterExitUseCase` recalcula con `PricingPolicy` al momento real de salida y valida contra el pago existente
- [x] Filtro HTTP actualizado (`OVERSTAY_PAYMENT_INSUFFICIENT` → 402)
- [x] Test del use case (`register-exit.use-case.spec.ts`, 5 tests) + del top-up (`register-payment.use-case.spec.ts`, 5 tests, nuevo — no existía spec para este use case)
- [x] `PaymentRepositoryPort.increaseAmount` + implementación Prisma, para soportar el pago de la diferencia sin romper el `@unique` de `sessionId`
- [x] Paso de demo documentado en el runbook (`docs/demo-runbook.md`)
- [x] Probado manualmente contra Postgres real: reserva → ingreso → pago corto (S/6) → `entryAt` retrasado 3h (simula sobre-estadía) → intento de salida → `402` con "Falta pagar S/ 18.00" → pago de la diferencia (mismo `payment.id`, monto acumulado a S/24, `externalReference` concatenada) → reintento de salida → `201`, sesión `COMPLETED`

**E3 — cerrado.**

---

### E4 — Revalidación en cascada al confirmar sucursal sugerida (ya funciona — falta evidenciarlo)

**Hallazgo:** `POST /reservations/confirm-suggestion` ya llama a `CreateReservationUseCase.execute` con la sucursal sugerida como nueva `branchId`, lo que **ya** vuelve a ejecutar `SlotAssignmentPolicy.assign()` completo. Si esa sucursal también se llenó mientras el usuario decidía, el sistema automáticamente vuelve a sugerir la siguiente más cercana (o `NO_AVAILABILITY` si ninguna tiene cupo). No hace falta código nuevo.

**Lo que sí falta:** un test explícito que documente este comportamiento (hoy es "accidental" por reuso de código, no está garantizado por un test que falle si alguien lo rompe sin querer).

**Archivos:**
- Nuevo: caso de test en `application/use-cases/reservations/create-reservation.use-case.spec.ts` (si no existe, crearlo) que simule: sucursal A llena → sugiere B → B también llena → sugiere C.
- Modificado: `docs/demo-runbook.md` → agregar este paso a la sección 3 (casos para el jurado).

- [x] Test de cascada agregado (`create-reservation.use-case.spec.ts`, nuevo — no existía spec para este use case; 3 tests: cascada A→B→C, asignación directa en la sucursal sugerida, `NO_AVAILABILITY`)
- [x] Paso agregado al runbook

**E4 — cerrado.** Solo test nuevo, sin cambios de código de producción (el comportamiento ya funcionaba por reuso de `CreateReservationUseCase`, tal como se había detectado leyendo el código).

---

### E5 — Métodos de pago múltiples (Strategy) — efectivo, tarjeta, Yape, Plin

**Objetivo:** demostrar el patrón Strategy + Factory de forma vistosa en la demo (elegir método de pago en el frontend, ver que la respuesta mockeada varía), manteniendo `PaymentMethod` como el puerto de dominio ya existente.

**Diseño:**
- El dominio ya declara `PaymentMethod.charge(input: ChargeInput): Promise<ChargeResult>`. Se le agrega `method: PaymentMethodType` a `ChargeInput` — el dominio conoce que existen distintos métodos (es una regla de negocio: el usuario elige cómo paga), pero **no conoce Yape ni Plin como marcas concretas**, solo el enum.
- En infraestructura, un único adapter `PaymentMethodRouterAdapter` (implementa `PaymentMethod`) internamente delega a 4 mini-adapters (`CashPaymentAdapter`, `CardPaymentAdapter`, `YapePaymentAdapter`, `PlinPaymentAdapter`), cada uno también implementando `PaymentMethod`. Es el mismo Strategy + Factory que ya usa el proyecto para políticas (ver `policies.module.ts`), aplicado a pagos.
- Regla mock por método (variación cosmética para que la demo se vea real, pero todos respetan la Política 8 del doc: rechazar solo si monto ≤ 0):
  - Efectivo/Tarjeta/Yape/Plin: aprueban salvo monto ≤ 0.
  - `externalReference` con prefijo distinto por método (`CASH-`, `CARD-`, `YAPE-`, `PLIN-`) para que se note en la respuesta cuál se usó.

**Archivos:**
- Nuevo: `domain/enums/payment-method-type.enum.ts` → `CASH | CARD | YAPE | PLIN`
- Modificado: `domain/policies/payment-method.port.ts` → agregar `method: PaymentMethodType` a `ChargeInput`
- Nuevo: `infrastructure/payments/cash-payment.adapter.ts`
- Nuevo: `infrastructure/payments/card-payment.adapter.ts`
- Nuevo: `infrastructure/payments/yape-payment.adapter.ts`
- Nuevo: `infrastructure/payments/plin-payment.adapter.ts`
- Nuevo: `infrastructure/payments/payment-method-router.adapter.ts` (Strategy dispatcher)
- Modificado: `infrastructure/modules/policies.module.ts` (o donde se registre `PAYMENT_METHOD`) → bindear al router en vez de al mock único
- Modificado: `application/use-cases/payments/register-payment.use-case.ts` → agregar `method: PaymentMethodType` a `RegisterPaymentInput`, pasarlo al `charge()`
- Modificado: `presentation/http/dto/payments/register-payment.dto.ts` → agregar `@IsEnum(PaymentMethodType) method: PaymentMethodType`
- Modificado: `presentation/http/controllers/payments.controller.ts` → pasar `dto.method`
- Mantener: `mock-payment-method.adapter.ts` puede quedar como implementación por defecto de cada mini-adapter o eliminarse si el router lo reemplaza del todo (decidir al implementar).

**Criterio de aceptación:** el frontend permite elegir método de pago; la respuesta del backend refleja el método elegido (`externalReference` con el prefijo correcto); cambiar de método no requiere tocar `RegisterPaymentUseCase` más allá del campo `method` ya agregado (agregar un 5º método en el futuro es solo un adapter nuevo + una línea en el router).

- [x] Enum (`domain/enums/payment-method-type.enum.ts`) y puerto actualizados (`ChargeInput.method`)
- [x] 4 adapters + router creados (`infrastructure/payments/{cash,card,yape,plin}-payment.adapter.ts` + `payment-method-router.adapter.ts`); se eliminó `mock-payment-method.adapter.ts` (reemplazado por completo, sin usos ni tests que dependieran de él)
- [x] Wiring en `core-infra.module.ts` (no en `policies.module.ts` como decía el plan original — `PAYMENT_METHOD` ya se registraba ahí, no en `PoliciesModule`; se corrigió al implementar)
- [x] Use case + DTO + controller actualizados (`RegisterPaymentUseCase`, `register-payment.dto.ts` con `@IsEnum`, `payments.controller.ts`)
- [x] Frontend: selector de método de pago en `ActiveSessionCard.tsx` (reutiliza el componente `Select` ya existente, mismo patrón que `ReservationModal.tsx`); build (`tsc -b && vite build`) y `oxlint` limpios. No se pudo verificar visualmente en navegador esta sesión (sin herramientas de navegador disponibles) — pendiente de una pasada visual antes de la sustentación.
- [x] Test del router (Strategy) cubriendo los 4 métodos + rechazo por monto ≤ 0 (`payment-method-router.adapter.spec.ts`, 8 tests)
- [x] Probado manualmente contra Postgres real: pago con `YAPE` → `externalReference` con prefijo `YAPE-`; DTO rechaza `method` inválido o ausente con `400`

**E5 — cerrado** (backend completo y validado contra Postgres real; frontend implementado y con build/lint verdes, falta solo la revisión visual en navegador).

---

## 5. Fuera de alcance — recordatorio

No modificar sin avisar al equipo: `ReservationPolicy`, `login/JWT/roles`, scheduler de expiración, dashboard admin, `PricingPolicy` en sí (solo se **consume** su interfaz desde E3), promociones/convenios institucionales.

---

## 6. Patrones de diseño aplicados (para la sustentación)

| Patrón | Dónde | Por qué encaja en Onion |
|---|---|---|
| **Strategy** | `SlotAssignmentPolicy` (default vs balanced), `PaymentMethod` (efectivo/tarjeta/Yape/Plin) | El dominio define el contrato; la implementación concreta es intercambiable sin tocar quien la usa |
| **Factory (simple, vía DI)** | `policies.module.ts` decide qué `SlotAssignmentPolicy` construir según config; `PaymentMethodRouterAdapter` decide qué mini-adapter usar según `method` | Aísla la decisión de "qué implementación" en un solo punto de infraestructura/wiring |
| **Repository** | `domain/ports/*.repository.port.ts` + implementaciones Prisma | El dominio no sabe que existe Prisma ni SQL |
| **Adapter (Ports & Adapters)** | Todo `infrastructure/` implementando interfaces de `domain/` y `application/ports/` | Es la base misma de Onion: la infraestructura se adapta al dominio, no al revés |
| **Dependency Inversion** | Todos los `@Inject(TOKEN)` con tokens `Symbol()` en `domain/ports/tokens.ts` | El dominio declara la interfaz; Nest resuelve la implementación en runtime |

---

## 7. Checklist general de avance

- [x] E1 — Política de asignación alternativa (implementada, testeada unitariamente y verificada contra Postgres real)
- [x] E2 — Anti-replay de QR de entrada (implementada, testeada unitariamente y verificada contra Postgres real)
- [x] E3 — Sobre-estadía / pago insuficiente (implementada, incluyendo top-up de pago, testeada unitariamente y verificada contra Postgres real)
- [x] E4 — Test de revalidación en cascada (comportamiento ya existía por reuso de código; agregado el test que lo documenta)
- [x] E5 — Métodos de pago múltiples (backend validado contra Postgres real; frontend con build/lint verdes, falta revisión visual)
- [x] Runbook de demo actualizado con los pasos nuevos
- [x] `npm run test` verde con todo lo nuevo (43 tests, backend)
- [ ] Ensayo completo de demo (checklist del `demo-runbook.md` + casos nuevos) — pendiente, hacerlo antes de la sustentación
- [ ] Revisión visual en navegador del selector de método de pago (E5, frontend)

---

## 8. Referencias

- Documento base: `documento-implementacion-v2.docx`
- Runbook de demo actual: `docs/demo-runbook.md`
- Distribución de trabajo original: sección 11 del documento base
