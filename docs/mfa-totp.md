# Verificación en dos pasos (MFA) con Google Authenticator

Cómo se implementó el segundo factor de autenticación con TOTP (RFC 6238): por qué no hace falta
ninguna cuenta ni credencial de Google, cómo encaja en la arquitectura hexagonal sin tocar los logins
existentes, y qué decisiones de seguridad hay detrás de cada endpoint.

| | |
|---|---|
| Rama | `feat/auth-mfa-totp` |
| Alcance | backend (4 casos de uso, 2 puertos out, 2 adaptadores, migración) + frontend (2 páginas) |
| Hermanos | [`login-google-firebase.md`](login-google-firebase.md) · [`login-facebook.md`](login-facebook.md) |

## La idea en una línea

Google Authenticator **no es un servicio de Google**: es una app que calcula un código de 6 dígitos a
partir de un secreto compartido y la hora actual. El backend genera ese secreto, se lo muestra al
usuario como QR una sola vez, y a partir de ahí ambos lados calculan el mismo código de forma
independiente y sin red. Cualquier app TOTP (Microsoft Authenticator, Authy, 1Password…) funciona igual.

```
code = HOTP(secret, floor(unixSeconds / 30))
     = truncate( HMAC-SHA1(secret, step) ) mod 10^6
```

## El camino de un login con MFA

```
NAVEGADOR   POST /auth/login { email, password }
                     │
API         LoginUserUseCase ─── password OK ───> issueSession(user)
                                                       │
                                        user.mfaEnabled ?  ── no ──> { accessToken, user }   (igual que siempre)
                                                       │
                                                      sí
                                                       ▼
                                        { mfaRequired: true, mfaToken }   JWT de 5 min, claim purpose='mfa'
                     │
NAVEGADOR   /mfa  ── el usuario escribe el código de la app ──> POST /auth/mfa/verify { mfaToken, code }
                     │
API         VerifyMfaUseCase
               1) TokenPort.verifyMfaChallenge(mfaToken)     -> userId (rechaza access tokens)
               2) UserRepositoryPort.findMfaCredentials      -> secreto cifrado, lastStep, backup codes
               3) SecretCipherPort.decrypt(secreto)
               4) TotpPort.verify(secreto, code)             -> step | null   (ventana ±30 s)
               5) step > lastStep ? guardar lastStep : rechazar   (anti-replay)
               6) issueAccessSession(user)                   -> { accessToken, user }
```

`issueSession` es el cierre compartido de **los tres** logins (password, Google, Facebook): validado
el primer factor, decide si emite la sesión o el desafío. Un proveedor nuevo hereda el MFA sin código.

## Activación (una sola vez)

```
POST /auth/mfa/setup      (Bearer)  -> genera secreto, lo cifra y lo guarda SIN activar
                                        devuelve { secret, otpauthUri }
                                        el frontend renderiza otpauthUri como QR (lib `qrcode`)
[usuario escanea con Google Authenticator]
POST /auth/mfa/confirm    (Bearer)  -> primer código correcto: mfaEnabled = true
                                        devuelve { backupCodes: [8 códigos XXXX-XXXX] } una única vez
DELETE /auth/mfa          (Bearer)  -> exige un código vigente; borra todo el material MFA
```

Activar en dos pasos evita que un usuario que cierra la pantalla a mitad del setup quede bloqueado:
hasta que no confirma con un código real, el login sigue siendo solo con contraseña.

## Piezas en la arquitectura hexagonal

| Pieza | Archivo | Rol |
|---|---|---|
| Puertos in | `core/ports/in/auth/{setup,confirm,verify,disable}-mfa.port.ts` | Contratos de los 4 casos de uso |
| Casos de uso | `core/application/use-cases/auth/{setup,confirm,verify,disable}-mfa.use-case.ts` | Orquestan; no conocen crypto ni Prisma |
| Cierre compartido | `core/application/use-cases/auth/issue-session.ts` | `issueSession` / `issueAccessSession`, tipo `LoginUserResult` |
| Puerto out `TotpPort` | `core/ports/out/totp.port.ts` | `generateSecret`, `buildOtpAuthUri`, `verify → step` |
| Adaptador | `adapters/out/auth/rfc6238-totp.adapter.ts` | HOTP/TOTP + base32 con `node:crypto`, **sin dependencias**; testeado contra los vectores de la RFC |
| Puerto out `SecretCipherPort` | `core/ports/out/secret-cipher.port.ts` | `encrypt` / `decrypt` |
| Adaptador | `adapters/out/auth/aes-gcm-secret-cipher.adapter.ts` | AES-256-GCM, IV por valor, clave derivada de `MFA_ENCRYPTION_KEY` |
| `TokenPort` ampliado | `core/ports/out/token.port.ts` + `adapters/out/auth/jwt-token.adapter.ts` | `signMfaChallenge` / `verifyMfaChallenge`; `verify` rechaza tokens con `purpose='mfa'` |
| `UserRepositoryPort` ampliado | `core/ports/out/user.repository.port.ts` | `findMfaCredentials`, `updateMfa` — el material MFA **no** viaja en la entidad `User` |
| Adaptador in | `adapters/in/http/controllers/auth.controller.ts` | 4 endpoints nuevos, rate limit con `ThrottlerGuard` |
| Errores | `core/domain/errors/{invalid-mfa-code,mfa-already-enabled,mfa-not-configured}.error.ts` | 401 / 409 / 409 |
| Persistencia | `prisma/migrations/20260914120000_add_user_mfa` | `mfaEnabled`, `totpSecretEnc`, `totpLastStep`, `mfaBackupCodes[]` |
| Frontend | `pages/MfaChallengePage.tsx` (`/mfa`) · `pages/security/SecurityPage.tsx` (`/seguridad`) · `hooks/useLoginResult.ts` | Segundo paso del login · activar/desactivar · cierre común de los 3 botones de login |

## Decisiones de seguridad (y la pregunta que responden)

| Decisión | Pregunta que responde |
|---|---|
| El `mfaToken` lleva `purpose: 'mfa'` y `JwtTokenAdapter.verify` lo rechaza | *¿Y si alguien roba el mfaToken? ¿Puede llamar a la API?* No: solo sirve para `/auth/mfa/verify` y dura 5 min. |
| El secreto TOTP se guarda cifrado (AES-256-GCM) y vive fuera de la entidad `User` | *¿Un dump de la DB o `GET /users/me` expone el secreto?* No: en la DB está cifrado y nunca se serializa en una respuesta. |
| Se guarda `totpLastStep` y se rechaza `step <= lastStep` | *¿Se puede reusar un código interceptado dentro de los 90 s de ventana?* No. |
| `ThrottlerGuard`: 5 intentos/min en `verify`, `confirm` y `disable` | *¿Se puede adivinar el código por fuerza bruta?* 10⁶ combinaciones a 5/min no alcanza antes de que expire. |
| Backup codes hasheados con bcrypt, de un solo uso, alfabeto sin 0/O/1/I | *¿Y si pierde el celular?* 8 códigos de respaldo mostrados una sola vez. |
| Desactivar exige un código vigente | *¿Una sesión abierta en otro dispositivo puede apagar el MFA?* No sin el celular. |
| Comparación con `timingSafeEqual` | *¿Se puede inferir el código midiendo tiempos de respuesta?* No. |
| Ventana de ±1 step (30 s) | *¿Qué pasa si el reloj del celular o del servidor está desfasado?* Tolera hasta 30 s; el contenedor sincroniza NTP. |

## Configuración

```
MFA_ENCRYPTION_KEY=          # openssl rand -base64 32 ; si falta se deriva de JWT_SECRET
MFA_CHALLENGE_EXPIRES_IN=5m  # vigencia del mfaToken
```

Nada más: no hay cuenta de Google, ni Firebase, ni claves de API. Se prueba con cualquier celular.

Aplicar la migración: `npx prisma migrate deploy` (el `docker-compose.yml` ya lo hace al arrancar).

## Probarlo en 2 minutos

1. Login normal → `/seguridad` → **Activar** → escanear el QR con Google Authenticator.
2. Escribir el código de la app → **Confirmar y activar** → anotar un backup code.
3. Salir → login → aparece `/mfa` → escribir el código → entra.
4. Repetir el mismo código antes de 30 s → *"Código inválido o ya utilizado"* (anti-replay).
5. Login → `/mfa` → *"¿Perdiste el celular?"* → backup code → entra; el mismo código no sirve dos veces.
6. En DevTools → Network, el `POST /auth/login` responde `{ mfaRequired: true, mfaToken }` sin `accessToken`.

## Preguntas esperables

- **¿Por qué no `otplib` / `speakeasy`?** El algoritmo son ~40 líneas sobre `node:crypto` y así se puede
  explicar en la exposición línea por línea; está validado contra los 6 vectores oficiales de la RFC 6238.
- **¿Por qué no SMS o correo?** TOTP no depende de red ni de un tercero, y el secreto nunca sale del
  servidor después del setup. SMS es interceptable (SIM swap) y el correo ya es el factor de recuperación.
- **¿Qué pasa si cambia `MFA_ENCRYPTION_KEY`?** Los secretos guardados dejan de descifrarse; los usuarios
  tendrían que reactivar MFA. Por eso se recomienda una clave propia y estable desde el inicio.
- **¿Se aplica a Google y Facebook?** Sí: los tres logins pasan por `issueSession`, así que si la cuenta
  tiene MFA activo, entrar con Facebook también pide el código.
- **¿Cómo se relaciona con OAuth 2.0?** Son ortogonales. OAuth resuelve *quién es* el usuario a través de
  un proveedor (Google/Facebook); MFA agrega *algo que tiene* (el celular) después de eso. Por eso el
  MFA se engancha en `issueSession`, común a todos los caminos.
