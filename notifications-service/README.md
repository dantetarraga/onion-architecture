# notifications-service

Servicio aislado (proceso y deploy propios, sin dependencias del backend en
codigo) que consume el topico de Kafka `notifications.email.confirmation` y
envia el correo de confirmacion de reserva al usuario.

Comparte con el backend **solo el contrato del evento** (`src/types.ts` es un
espejo manual de `backend/src/core/ports/out/notification-publisher.port.ts`),
no codigo ni proceso.

## Correr

Con Docker (recomendado, junto al resto del stack):

```bash
docker compose up -d notifications-service
docker compose logs -f notifications-service
```

Standalone en el host (Kafka debe estar accesible en `localhost:29092`):

```bash
cd notifications-service
cp .env.example .env   # completar MAIL_* si se quiere enviar correo real
npm install
npm run start:dev
```

## Variables de entorno

Ver `.env.example`. Las relevantes al correo:

- `MAIL_ENABLED` (default `false`): en `false` el servicio **no** llama al
  SMTP real, solo loguea el correo que hubiera enviado (dry-run seguro).
- `MAIL_HOST` (default `mail.motoya.com.pe`), `MAIL_PORT` (default `465`,
  TLS implicito).
- `MAIL_USERNAME` / `MAIL_PASSWORD`: credenciales SMTP.
- `MAIL_FROM_EMAIL` (default `notificaciones@motoya.com.pe`).

## Resiliencia

- Un mensaje que no es JSON valido o no tiene la forma esperada se descarta
  con un log, sin tumbar el consumidor.
- El envio de correo reintenta hasta 3 veces (backoff simple) ante errores
  transitorios de SMTP; si se agotan los reintentos, se loguea el fallo y se
  sigue con el siguiente mensaje (no hay outbox/dead-letter en este alcance).
