# Observabilidad: Prometheus + Grafana

Cada microservicio publica sus métricas en formato Prometheus; Prometheus las recoge
cada 15 s y Grafana las muestra en un dashboard ya provisionado. No hace falta configurar
nada a mano: `docker compose up --build` levanta todo.

## Rutas

| Qué | URL | Credenciales |
|---|---|---|
| Dashboard de Grafana | http://localhost:3100/d/smart-parking-overview/smart-parking-microservicios | `admin` / `admin` (`GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`) |
| Grafana (home = el mismo dashboard) | http://localhost:3100 | idem |
| Prometheus: estado de cada servicio | http://localhost:9090/targets | — |
| Prometheus: alertas | http://localhost:9090/alerts | — |
| Prometheus: consultas PromQL a mano | http://localhost:9090/query | — |
| Métricas crudas de un servicio | no se publica al host | `docker compose exec gateway wget -qO- localhost:9464/metrics` |

## Cómo funciona todo, paso a paso

Ejemplo: un usuario paga una sesión desde el frontend.

1. **El servicio mide en memoria.** El request `POST /payments` entra por el gateway y
   sigue a payments-service. En cada uno, el middleware `httpMetricsMiddleware` arranca un
   cronómetro y, al terminar la respuesta, suma una observación al histograma
   `http_server_request_duration_seconds` con `method`, `route` y `status_code`. El
   controller de pagos, además, suma 1 a `payments_registered_total{method="YAPE",status="APPROVED"}`
   y el monto a `payments_amount_total`. La consulta gRPC a backend (`GetSessionQuote`) la
   mide `GrpcMetricsInterceptor` en backend. Nada de esto sale del proceso todavía: son
   contadores en memoria de `prom-client`.
2. **El servicio expone lo que tiene.** Cada proceso abre un servidor HTTP mínimo en
   `:9464` (`startMetricsServer()`, llamado en su `main`/`index`). `GET /metrics` devuelve el
   valor actual de todos sus contadores en formato texto de Prometheus. Este puerto solo
   existe dentro de la red de Docker.
3. **Prometheus hace pull.** Cada 15 s (`scrape_interval`), Prometheus resuelve por DNS
   cada nombre de servicio (`gateway`, `backend`, `reservations-worker`, …), obtiene la IP de
   cada réplica y le pide `/metrics`. Guarda cada valor con su timestamp en su base de
   series de tiempo (volumen `prometheus-data`, retención `PROMETHEUS_RETENTION`, 7 días
   por defecto). Si un servicio no responde, su serie `up` pasa a 0.
4. **Prometheus evalúa las alertas.** Cada 15 s también corre las reglas de `alerts.yml`
   sobre lo guardado (p. ej. "`up == 0` durante 1 min") y marca cada alerta como
   inactive, pending o firing. Se ven en `/alerts`.
5. **Grafana consulta a Prometheus.** Al abrir el dashboard, cada panel manda su query
   PromQL a Prometheus (datasource `prometheus`) y dibuja el resultado. Por ejemplo, el
   panel de req/s usa `rate(...count[1m])`, que convierte el contador acumulado en
   requests por segundo. El dashboard se refresca cada 10 s.

Resumen: **los servicios solo cuentan y exponen; Prometheus recoge, guarda y alerta;
Grafana solo lee de Prometheus y grafica.** Si Prometheus o Grafana se caen, los
microservicios siguen funcionando igual.

### Cómo arranca todo solo

- `docker compose up --build` levanta `prometheus` y `grafana` junto al resto.
- Prometheus lee `observability/prometheus/prometheus.yml` (qué scrapear) y `alerts.yml`
  (reglas), montados como solo lectura.
- Grafana lee `observability/grafana/provisioning/`: `datasources/prometheus.yml` crea la
  conexión a `http://prometheus:9090` y `dashboards/dashboards.yml` carga todo JSON de
  `observability/grafana/dashboards/` en la carpeta "Smart Parking".

### Archivos

| Archivo | Rol |
|---|---|
| `<servicio>/src/observability/metrics.ts` (Nest) · `src/metrics.ts` (realtime, notifications) | Registry, métricas, middleware HTTP y servidor `/metrics` |
| `auth-service`, `backend`, `payments-service`: `src/observability/grpc-metrics.interceptor.ts` | Mide cada llamada gRPC |
| `*/src/bootstrap/main.ts`, `backend/src/bootstrap/worker-main.ts`, `src/index.ts` | Registran el middleware y arrancan `startMetricsServer()` |
| `observability/prometheus/prometheus.yml` | Targets a scrapear |
| `observability/prometheus/alerts.yml` | Reglas de alerta |
| `observability/grafana/provisioning/` | Datasource y proveedor de dashboards |
| `observability/grafana/dashboards/smart-parking-overview.json` | El dashboard |

### Agregar una métrica nueva

1. Declararla en el `metrics.ts` del servicio con `registers: [registry]`, por ejemplo:
   ```ts
   export const reservationsCancelled = new Counter({
     name: 'reservations_cancelled_total',
     help: 'Reservas canceladas, por motivo.',
     labelNames: ['reason'] as const,
     registers: [registry],
   });
   ```
2. Incrementarla en el **adaptador** donde ocurre el hecho (controller, consumer), no en el
   caso de uso: `reservationsCancelled.inc({ reason: 'expired' })`. Solo usar etiquetas con
   pocos valores posibles (nunca ids ni emails: cada valor distinto es una serie nueva).
3. Rebuild del servicio (`docker compose up -d --build <servicio>`). Prometheus la toma sola
   en el siguiente scrape; no hay que tocar `prometheus.yml`.
4. Graficarla: agregar un panel en Grafana, exportar el JSON del dashboard y reemplazar
   `smart-parking-overview.json` para que quede versionado.

Un **servicio nuevo** sí requiere un job en `prometheus.yml` (copiar uno de los
`dns_sd_configs` con el nombre del servicio de Compose y `port: 9464`).

## Cómo se recogen

```
gateway, auth-service, backend,          GET /metrics :9464
reservations-worker, payments-service, ───────────────────────┐
realtime-service, notifications-service   (1 target/réplica)  ▼
                                                        ┌────────────┐
rabbitmq  ── :15692/metrics/detailed ─────────────────▶ │ Prometheus │ ──▶ Grafana :3100
                                                        └────────────┘
```

- **Librería:** `prom-client` en los 6 proyectos Node. Cada uno tiene su módulo de
  métricas: `src/observability/metrics.ts` en los servicios NestJS y `src/metrics.ts` en
  `realtime-service` y `notifications-service`.
- **Puerto propio (`METRICS_PORT`, 9464), no el de la API.** Así `/metrics` nunca queda
  expuesto a través del gateway (el `:3000` es público y reenvía por path), y funciona
  igual en procesos que no sirven HTTP (`reservations-worker`, `notifications-service`).
  El puerto no se publica al host: solo lo ve Prometheus en la red de Compose.
- **Etiqueta `service`** en todas las series (`SERVICE_NAME`). `backend` y
  `reservations-worker` son el mismo build; esta etiqueta es la que los separa.
- **Descubrimiento por DNS** (`dns_sd_configs` en `observability/prometheus/prometheus.yml`):
  el DNS de Compose resuelve el nombre del servicio a todas sus réplicas, así que
  `docker compose up --scale reservations-worker=3` aparece como 3 targets sin tocar la config.
- **Métricas de runtime:** `collectDefaultMetrics()` agrega CPU, memoria, heap, GC y
  *event loop lag* de cada proceso.

## Qué se mide

### HTTP: `http_server_request_duration_seconds` (histograma)

Etiquetas `method`, `route`, `status_code`. `route` es el **patrón** de Nest
(`/branches/:id`), nunca la URL cruda: de lo contrario habría una serie por cada id.
Lo que no matchea ninguna ruta cae en `route="unmatched"`.

En el **gateway** hay además `upstream` (`gateway`, `backend`, `payments-service`,
`realtime-service`), calculado con la misma función que decide el proxy
(`upstreamFor` en `gateway/src/proxy/proxy.middleware.ts`). En lo reenviado el gateway no
conoce el patrón de la ruta, así que queda `route="proxy"`: el detalle por ruta lo mide
cada upstream.

### gRPC interno: `grpc_server_handling_seconds` (histograma)

En los tres servidores gRPC (`AuthService`, `ParkingService`, `PaymentsService`), vía
`GrpcMetricsInterceptor` aplicado con `@UseInterceptors` en cada controller gRPC.
`grpc_status` distingue:

- `OK`
- `DOMAIN_ERROR`: un `DomainError` traducido a `RpcException` por `callUseCase`
  (p. ej. login con clave incorrecta). Es un rechazo de negocio esperado, no una falla.
- `ERROR`: cualquier otra excepción.

No es un interceptor global a propósito: para heredarlo, el microservicio gRPC
necesitaría `inheritAppConfig: true`, que también le aplicaría los filtros HTTP
(`DomainExceptionFilter`).

### Negocio

| Métrica | Servicio | Etiquetas | Significado |
|---|---|---|---|
| `reservation_requests_processed_total` | reservations-worker | `outcome`: `processed` / `failed` / `invalid` | Desenlace de cada mensaje de `reservations.requests` (ack o nack a la DLQ). |
| `payments_registered_total` | payments-service | `method`, `status` | Pagos por `POST /payments`. |
| `payments_amount_total` | payments-service | `method` | Monto acumulado de pagos **aprobados**. |
| `notification_messages_total` | notifications-service | `outcome`: `sent` / `skipped` / `failed` / `invalid` | `skipped` = `MAIL_ENABLED=false` (dry-run). |
| `notification_email_send_attempts_total` | notifications-service | `result` | Intentos SMTP, reintentos incluidos. |
| `notification_message_processing_seconds` | notifications-service | — | Tiempo por mensaje, reintentos incluidos. |
| `realtime_connected_sockets` | realtime-service | — | Sockets conectados ahora a `/realtime` (por réplica). |
| `realtime_connection_attempts_total` | realtime-service | `result`: `accepted` / `missing_token` / `invalid_token` | Handshakes. |
| `realtime_events_relayed_total` | realtime-service | `event`, `target` | Eventos de `realtime.events` reemitidos. |
| `realtime_events_dropped_total` | realtime-service | — | Mensajes ilegibles o con target desconocido. |
| `realtime_rabbitmq_connected` | realtime-service | — | 1 si consume el exchange, 0 si está reconectando. |

Las métricas de negocio se incrementan en los **adaptadores de entrada** (consumer de la
cola, controller HTTP, relay), no en los casos de uso: el núcleo no se entera de que existe
Prometheus.

### RabbitMQ

El plugin `rabbitmq_prometheus` viene activo en la imagen oficial. Se lee
`/metrics/detailed?family=queue_coarse_metrics&family=queue_consumer_count` para tener
series **por cola**: `rabbitmq_detailed_queue_messages_ready`,
`rabbitmq_detailed_queue_messages_unacked`, `rabbitmq_detailed_queue_consumers`.

## Dashboard

`observability/grafana/dashboards/smart-parking-overview.json` (también es el home de
Grafana). Filas:

1. **Salud:** `up` de cada target (una tarjeta por réplica).
2. **HTTP:** req/s, % 5xx y p95 por servicio; tráfico del gateway por upstream; p95 por ruta.
3. **gRPC interno:** llamadas por método/estado y p95.
4. **Reservas:** desenlaces del worker, mensajes y consumidores por cola.
5. **Pagos:** aprobados y monto cobrado en el rango visible, por método.
6. **Tiempo real y notificaciones:** sockets conectados, eventos reemitidos, correos.
7. **Runtime Node.js:** CPU, heap y *event loop lag* p99.

El dashboard se puede editar desde la UI (`allowUiUpdates`), pero los cambios viven en el
volumen de Grafana: para versionarlos, exportar el JSON y reemplazar el archivo.

## Alertas

`observability/prometheus/alerts.yml`. No hay Alertmanager: el estado se ve en
http://localhost:9090/alerts.

| Alerta | Condición |
|---|---|
| `ServiceDown` | un target no responde el scrape durante 1 min |
| `HighHttpErrorRate` | más del 5 % de 5xx en un servicio durante 5 min |
| `HighHttpLatencyP95` | p95 HTTP > 1 s durante 5 min |
| `ReservationRequestsFailing` | alguna solicitud fue a la DLQ en los últimos 5 min |
| `ReservationsQueueBacklog` | más de 20 mensajes listos en `reservations.requests` durante 2 min |
| `NotificationEmailsFailing` | algún correo agotó los reintentos en los últimos 10 min |

## Para la demo

- **Cola acumulándose:** `docker compose stop reservations-worker`, crear reservas desde el
  frontend y mirar "Mensajes en cola"; el target del worker pasa a DOWN y a los ~2 min
  dispara `ReservationsQueueBacklog`. Al volver a levantarlo, la cola se vacía y el panel
  "Solicitudes procesadas" muestra el pico.
- **Competing consumers:** `docker compose up -d --scale reservations-worker=3` → tres
  tarjetas en "Servicios arriba" y 3 consumidores en `reservations.requests`.
- **Servicio caído:** `docker compose stop payments-service` → `up` en rojo, 5xx en el gateway
  con `upstream="payments-service"` y `ServiceDown` tras 1 min.

## Correr fuera de Docker

Cada servicio abre igual su `/metrics` en `:9464`. Si se levantan varios en la misma
máquina hay que darles `METRICS_PORT` distintos. `prometheus.yml` apunta a los nombres de
Compose, así que fuera de Docker solo sirve como referencia.
