# Guion de exposición — "El Núcleo Blindado" (diapositivas 1 a 5)

Guion de lectura corrida para la primera parte de la presentación del equipo
(`Shielding_the_Business_Core.pdf`). Cubre las diapositivas 1 a 5 —portada,
el problema original, el estado actual en Hexagonal, la regla de
dependencias y la matriz de transición estructural—. Duración estimada:
6-7 minutos.

Incorpora hallazgos propios de la investigación del repositorio (rama
`main` = Onion, `refactor/hexagonal-architecture` = Hexagonal + Prisma,
`feat/ver2-hexagonal-architecture-mongo-db` = Hexagonal + Mongo, esta
última es la que documenta la diapositiva 3) y del plan de migración a
Clean Architecture (`docs/plan-migracion-clean-architecture.md`).

---

## Diapositiva 1 — Portada: "El Núcleo Blindado"

> Buenas [tardes/días]. Vamos a hablar de algo que suena a detalle interno
> del código, pero que en la práctica decide si un sistema aguanta años de
> cambios o se vuelve intocable en pocos meses: cómo blindamos las reglas
> de negocio del framework y de la infraestructura que las rodea.
>
> El título de esta primera parte es "El Núcleo Blindado" porque esa es,
> literalmente, la pregunta que investigamos: ¿qué tan protegido está el
> corazón de nuestro sistema —las reglas de reservas, de asignación de
> cocheras, de pagos— frente a todo lo que cambia alrededor: la base de
> datos, el framework, el protocolo HTTP?
>
> Y quiero ser precisos con algo desde el arranque: esto no es un caso de
> estudio de un libro. Es nuestro propio proyecto —un sistema de
> estacionamiento inteligente hecho en NestJS— y lo investigamos en tres
> estados distintos, porque nuestro repositorio literalmente conserva las
> tres versiones en ramas separadas: la versión original con Onion
> Architecture, una versión intermedia con Arquitectura Hexagonal usando
> Postgres, y la versión con Arquitectura Hexagonal usando MongoDB, que es
> la que van a ver hoy como nuestro "estado actual". Sobre esa base
> construimos el análisis completo, incluyendo un mapa de cómo se vería el
> siguiente paso hacia Clean Architecture.
>
> En los próximos minutos les vamos a mostrar en qué estado está el
> proyecto hoy, por qué llegamos hasta ahí —con nombres de carpeta reales,
> no genéricos— y hacia dónde apunta el siguiente paso.

**Punto clave a no perder:** dejás establecido desde el segundo uno que
existen 3 ramas reales investigadas, no una sola captura de pantalla. Eso
le da autoridad a todo lo que sigue.

---

## Diapositiva 2 — El problema original: lógica rehén de la tecnología

> Este problema no es hipotético — es la razón de ser de arquitecturas
> como Onion, Hexagonal o Clean. Miren el diagrama: rutas HTTP,
> validación, reglas de negocio, queries a la base de datos y la inyección
> del framework, todo enredado dentro del mismo módulo.
>
> El síntoma clásico es un controlador HTTP que consulta directamente a
> MongoDB. El problema de fondo es que la regla de negocio —por ejemplo,
> "¿hay cupo disponible en esta sede?"— queda fusionada con el detalle
> técnico de cómo se guarda ese dato. Y el impacto es el que más nos
> importa como equipo: si mañana cambiamos de base de datos o de
> framework, no tocamos un archivo, reescribimos servicios, controladores
> y pruebas enteras.
>
> Ahora, algo que sí investigamos a fondo: nuestro proyecto nunca llegó a
> este extremo de mezcla total, porque arrancó ya organizado por capas con
> Onion Architecture. La estructura original tenía carpetas de primer
> nivel bien separadas: `domain/`, `application/`, `infrastructure/` y
> `presentation/`, cada una con su responsabilidad. Pero encontramos
> acoplamientos de la misma familia, más sutiles, escondidos dentro de esa
> organización:
>
> Primero, dentro de `infrastructure/websocket/` convivían dos cosas que
> deberían estar separadas: el gateway que recibe conexiones de socket
> —algo que "entra" al sistema— y el adaptador que notifica cambios hacia
> afuera —algo que el sistema "pide" hacia afuera—. Estaban juntos porque
> se agrupó por tecnología (ambos usan Socket.io), no por dirección de
> dependencia.
>
> Segundo, no existía ninguna interfaz de "puerto de entrada": el
> controlador HTTP inyectaba directamente la clase concreta
> `CreateReservationUseCase`, no un contrato. Funcionaba, pero el
> controller terminaba acoplado a una clase específica en vez de a una
> abstracción.
>
> Y tercero, el puerto del método de pago vivía dentro de la carpeta de
> políticas de dominio, aunque conceptualmente llama a pasarelas de pago
> externas reales —efectivo, tarjeta, Yape, Plin—, algo que sí cruza
> fronteras del sistema.
>
> Ninguno de estos tres es tan grave como el diagrama de la izquierda,
> pero es exactamente la misma enfermedad en una versión más leve: la
> tecnología y el negocio compartiendo carpeta sin que nadie lo haya
> decidido a propósito.

**Punto clave a no perder:** acá es donde metés más músculo de
investigación — tres hallazgos concretos y verificables en el código, no
una opinión. Si alguien pregunta "¿dónde vieron eso?", tenés la respuesta
lista: en la carpeta `infrastructure/websocket/` y `domain/policies/` de
la rama original.

---

## Diapositiva 3 — Nuestro estado actual: Arquitectura Hexagonal

> Este diagrama no es genérico: es, literalmente, el estado actual de
> nuestro repositorio, en la rama de arquitectura hexagonal con MongoDB.
> Lo confirmamos revisando el código archivo por archivo: bajo
> `backend/src` hay tres carpetas raíz —`core`, `adapters` y `bootstrap`—
> con 168 archivos organizados bajo esa convención.
>
> Pero antes de entrar al detalle, quiero mostrarles el "antes y después"
> completo, porque eso es lo que realmente investigamos: cómo se tradujo
> cada carpeta de la versión Onion a esta versión Hexagonal.
>
> - `domain/` (con `entities/`, `enums/`, `errors/`, `policies/`) pasó a
>   vivir dentro de `core/domain/`.
> - `application/` (los casos de uso) pasó a `core/application/`.
> - Las interfaces que antes estaban repartidas entre `application/ports/`
>   y `domain/ports/` se juntaron en un solo lugar, pero además se
>   dividieron en dos por dirección: `core/ports/in/` y `core/ports/out/`.
> - `presentation/http/` pasó a `adapters/in/http/`.
> - `infrastructure/` se repartió entera entre `adapters/in/` (lo que
>   dispara al núcleo: HTTP, scheduler, la mitad "entrante" del WebSocket)
>   y `adapters/out/` (lo que el núcleo pide hacia afuera: persistencia,
>   auth, QR, pagos, y la mitad "saliente" del WebSocket).
> - Y todo el cableado de módulos de NestJS que antes vivía repartido en
>   `modules/` e `infrastructure/modules/` se consolidó en una sola
>   carpeta: `bootstrap/`.
>
> Ahora sí, al detalle de lo que queda adentro de cada una:
>
> El **Core** es el hexágono: `domain` con las entidades —Reservation,
> ParkingSlot, Branch, Payment, User—, sus enums, errores y cinco
> políticas de negocio intercambiables; más `application` con los casos de
> uso agrupados en siete carpetas por funcionalidad —auth, admin,
> branches, parking, payments, reservations, users—; más `ports`, con las
> interfaces que el núcleo expone y necesita. Verificamos directamente en
> el código algo clave: cero imports de NestJS o de Mongo dentro de
> `domain`. Ni una sola línea.
>
> Los **Adaptadores** son el borde, y ahí está el cambio más importante de
> esta migración: se formalizaron 25 puertos de entrada, uno por cada caso
> de uso. Ya no es que el controller le hable directo a la clase
> `CreateReservationUseCase`; le habla a una interfaz, `CreateReservationPort`.
> Eso resuelve exactamente el segundo hallazgo que mencioné en la
> diapositiva anterior. También se resolvieron los otros dos: el gateway
> de WebSocket y su notificador ahora están en carpetas separadas
> —`adapters/in/websocket/` y `adapters/out/realtime/`— y el puerto del
> método de pago se reclasificó a `core/ports/out/`, junto a los demás
> puertos que sí cruzan fronteras reales.
>
> Y el **Bootstrap** es el ensamblador: ahí es donde NestJS conecta cada
> puerto con su adaptador concreto en tiempo de ejecución —eso es justo lo
> que la siguiente diapositiva formaliza como regla.

**Punto clave a no perder:** esta diapositiva es donde demostrás que la
migración Onion → Hexagonal no fue "reordenar por las dudas": cada carpeta
nueva resuelve un hallazgo concreto de la diapositiva anterior. Es causa y
efecto, no coincidencia.

---

## Diapositiva 4 — La Meta: la Regla de Dependencias en Clean Architecture

> Esta es la regla que sostiene todo lo anterior, dicha en una frase: el
> dominio no sabe que existe MongoDB, un endpoint REST o un framework.
>
> Miren las flechas: la dirección correcta es hacia adentro. Web, DB y
> Frameworks pueden conocer a Controladores y Gateways; Controladores y
> Gateways pueden conocer a Casos de Uso; y Casos de Uso pueden conocer a
> Entidades. Nunca al revés —esa flecha tachada en rojo es la que no puede
> existir jamás, desde Entidades hacia afuera.
>
> Algo que nos pareció el hallazgo más importante de toda la
> investigación: esta regla es exactamente la misma en las tres
> arquitecturas que estudiamos —Onion, Hexagonal y Clean—. Lo que cambia
> entre ellas no es la regla, es el criterio para agrupar carpetas
> alrededor de esa regla. Onion agrupa por capa técnica —domain,
> application, infrastructure—. Hexagonal agrupa por dirección —quién
> llama a quién, in u out—. Clean agrupa por distancia a las reglas de
> negocio —cuatro anillos concéntricos—. Las tres carpetas distintas que
> van a ver en la próxima diapositiva existen únicamente para blindar esta
> misma flecha; ninguna es "más correcta" que otra.
>
> Dos ejemplos concretos de nuestro propio código que confirman esta regla
> en acción: el caso de uso de crear una reserva no dice "guarda esto en
> Mongo", dice "necesito un `ReservationRepositoryPort`". Quien traduce
> eso a Mongo es el adaptador `MongoReservationRepository` —y ahí pasa
> algo muy ilustrativo: Mongo genera un identificador llamado `_id`, pero
> el dominio solo conoce `id`. Es el adaptador quien hace esa traducción,
> nunca el caso de uso.
>
> El segundo ejemplo es el `ClockPort`: el núcleo pide "dame la hora
> actual" a través de una interfaz, no llama directamente a `Date.now()`
> del sistema operativo. Eso parece exagerado hasta que uno ve el
> porqué: en las pruebas automatizadas se reemplaza por un reloj falso, y
> así se pueden probar reglas de negocio que dependen del tiempo —como el
> vencimiento de una reserva— sin esperar minutos reales ni depender del
> reloj de la máquina.

**Punto clave a no perder:** el hallazgo fuerte de esta diapositiva es
"la regla no cambia entre las tres arquitecturas, solo el criterio de
carpetas" — es la idea que conecta las diapositivas 2, 3 y 5 en una sola
línea argumental.

---

## Diapositiva 5 — Matriz de Transición Estructural

> Esta tabla es la conclusión práctica de todo lo anterior: cómo migramos
> la estructura hexagonal que ya tenemos hacia Clean Architecture, sin
> reescribir el proyecto desde cero.
>
> `core/domain` se convierte simplemente en `domain`. `core/application` y
> `core/ports` se funden en `application`. `adapters/in` y `adapters/out`
> pasan a `infrastructure` —que también se puede llamar Interface Adapters
> según la fuente que consulten—. Y `bootstrap` pasa a llamarse `main`, o
> Composition Root.
>
> Acá quiero compartir el detalle completo de nuestra investigación,
> porque de hecho exploramos y documentamos dos caminos posibles para este
> mismo paso, no solo uno:
>
> El primero es exactamente este: una migración liviana, de cuatro
> carpetas, sin ceremonia. `domain`, `application`, `infrastructure`,
> `main`. Es el camino más pragmático para un proyecto que ya viene de
> Hexagonal y no necesita repetir la lección de las cuatro capas desde
> cero.
>
> El segundo camino que comparamos, y que dejamos documentado en detalle,
> es la nomenclatura clásica del libro de Robert C. Martin: `entities`,
> `use-cases`, `interface-adapters`, `frameworks-drivers`. Esta versión
> formaliza cada uno de los cuatro anillos con nombre propio, y además
> obliga a dos decisiones que la versión liviana no hace explícitas:
> primero, separar la interfaz de un puerto de salida —por ejemplo
> `ReservationRepositoryPort`— de su implementación concreta, dejando el
> contrato en `use-cases/ports/out/` y la implementación un anillo entero
> más afuera, en `interface-adapters/gateways/`. Y segundo, dejar en claro
> que los repositorios de Mongo no son "framework": son Gateways, un
> anillo más adentro que el propio driver de Mongo, que sí sería framework
> puro.
>
> Comparamos ambos caminos con el mismo criterio de la diapositiva
> anterior —¿protege igual la regla de dependencias?— y la respuesta fue
> sí, los dos. La diferencia es puramente didáctica: la nomenclatura
> completa es mejor si uno quiere enseñar los cuatro anillos con nombre
> propio a alguien que nunca vio Clean Architecture; la migración liviana
> es mejor si el equipo ya entiende la regla y solo necesita que el código
> la respete. Por eso llegamos a la misma conclusión que dice esta
> diapositiva: no es obligatorio renombrar carpetas para tener Clean
> Architecture real. Lo que la hace Clean no es el nombre de la carpeta,
> es que la flecha de dependencia jamás apunte hacia afuera.
>
> Con esto ya tienen el mapa completo: de dónde veníamos —Onion, tres
> carpetas técnicas—, dónde estamos parados hoy —Hexagonal, carpetas por
> dirección, con 25 puertos de entrada formalizados—, cuál es la meta —la
> regla de dependencias, idéntica en las tres arquitecturas—, y cómo se
> traduce esa meta a nuestras carpetas reales, con dos caminos posibles ya
> comparados. Lo que sigue es bajar todo esto a algo todavía más
> concreto: seguir una reserva real, paso a paso, atravesando cada una de
> estas capas —y ahí le paso la palabra a mi compañero.

**Punto clave a no perder:** el cierre de esta diapositiva es el momento
de mayor autoridad de toda tu parte — no solo repetís lo que dice el
slide, mostrás que comparaste dos alternativas reales y elegiste con
criterio.

---

## Si te preguntan (respaldo rápido)

- **"¿Por qué no eligieron la nomenclatura completa de Clean
  Architecture?"** → Porque el proyecto ya viene de Hexagonal, que ya
  separa por dirección; renombrar todo a
  `entities/use-cases/interface-adapters/frameworks-drivers` es más
  valioso cuando se enseña desde cero, no cuando ya existe la separación
  de fondo.
- **"¿Esto ya está implementado o es un plan?"** → Onion y las dos
  versiones de Hexagonal (Postgres y Mongo) están implementadas y viven en
  ramas reales del repo. Clean Architecture, tanto la versión liviana de
  esta diapositiva como la nomenclatura completa, es un plan documentado,
  todavía sin ejecutar.
- **"¿Cambiaron el comportamiento del sistema en algún refactor?"** → No.
  Cada migración de carpetas fue mover archivos y reescribir imports;
  ningún caso de uso ni política de negocio cambió su lógica.
- **"¿Por qué separar el gateway de WebSocket de su notificador si los dos
  usan Socket.io?"** → Porque la clasificación no es por tecnología, es
  por dirección: el gateway recibe conexiones (entra al núcleo), el
  notificador empuja eventos hacia afuera (el núcleo lo pide). Comparten
  tecnología pero no rol.
