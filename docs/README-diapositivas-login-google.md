# README — Diapositivas: Login con Google vía Firebase Authentication

Guía para armar la exposición de la funcionalidad del commit `9c0c2a5`
(`feat: login con Google via Firebase Authentication`). Cada bloque es **una
diapositiva**: título, bullets para pegar en la slide, visual sugerido y nota
de orador.

---

## Datos generales

| | |
|---|---|
| **Proyecto** | SIGE — Sistema Inteligente de Gestión de Estacionamientos |
| **Feature** | Botón "Continuar con Google" en Login y Registro |
| **Stack** | Frontend: React + Vite + `firebase` SDK · Backend: NestJS (Hexagonal) + `jose` |
| **Público** | Profesor + compañeros que ya conocen el proyecto y la arquitectura hexagonal |
| **Duración** | 8-10 min + preguntas (10 slides) |
| **Archivos tocados** | 20 archivos, ~1.290 líneas (la mayoría es `package-lock.json`) |
| **Frase-hilo** | *"Firebase autentica al usuario; nuestro backend solo verifica la firma y emite su propio JWT."* |

**Mensaje único:** el login social se integró como un caso de uso más de la
arquitectura hexagonal —un puerto `in`, un puerto `out`, un adaptador— sin
tocar el login por contraseña, el guard JWT, el repositorio ni el schema de la
base de datos.

---

## Slide 1 — Portada
- **Login con Google en SIGE** — Firebase Authentication + NestJS
- Integrantes, curso, fecha
- **Visual:** captura de la pantalla de login con el botón "Continuar con Google"
- **Nota:** 20 seg. Es una feature chica en líneas de código de negocio (~80 líneas de caso de uso), pero toca frontend, backend, config y Docker.

## Slide 2 — El problema
- Registro con email + contraseña = fricción: otra contraseña más que recordar
- Queremos que el usuario entre en un clic con su cuenta de Google
- Restricciones que nos pusimos:
  - No guardar contraseñas de Google ni depender de un secreto de Google en el backend
  - Que el resto de la app **no distinga** si el usuario entró por Google o por contraseña
  - No tocar el login existente, el guard JWT, ni el schema de la DB
- **Visual:** formulario tradicional vs. botón de Google, lado a lado
- **Nota:** las restricciones son lo que guía todas las decisiones que siguen.

## Slide 3 — ¿Por qué Firebase Authentication?
- Google recomienda Firebase Auth como capa sobre Google Sign-In para apps web
- El SDK resuelve el popup, el consentimiento OAuth y el manejo de sesión en el cliente
- Devuelve un **ID token** (JWT RS256) firmado por Google
- No necesita backend propio de OAuth (sin redirect URIs, sin client secret)
- La config web de Firebase (`apiKey`, `projectId`, …) es **pública por diseño** — se restringe por dominio en la consola
- **Visual:** logo Firebase + Google, flecha "ID token" hacia nuestro backend
- **Nota:** pregunta habitual: "¿el apiKey en el `.env.example` no es un secreto?" → no, es un identificador público; lo que protege es la restricción por dominio.

## Slide 4 — Flujo completo (la slide central)
```
1. Usuario hace clic en "Continuar con Google"
2. Frontend  -> signInWithPopup(firebaseAuth, googleAuthProvider)   [Firebase SDK]
3. Google    -> devuelve credential; credential.user.getIdToken()   [ID token JWT]
4. Frontend  -> POST /auth/google { idToken }                        [nuestra API]
5. Backend   -> verifica firma contra JWKS público de Google (jose)
6. Backend   -> busca usuario por email; si no existe, lo crea
7. Backend   -> firma su PROPIO accessToken (mismo TokenPort del login normal)
8. Frontend  -> setAuth(accessToken, user) y navega a /sucursales
```
- **Visual:** diagrama de secuencia con 4 actores: Usuario · Frontend · Google/Firebase · Backend
- **Nota:** el punto clave es el paso 7: a partir de ahí la app funciona exactamente igual que con email+password. Firebase solo se usa para *identificar*, no para *autorizar*.

## Slide 5 — Frontend: 3 piezas
- `frontend/src/lib/firebase.ts` — inicializa la app de Firebase leyendo `VITE_FIREBASE_*` del env; exporta `firebaseAuth` y `googleAuthProvider`
- `frontend/src/components/auth/GoogleAuthButton.tsx` — botón compartido por `LoginPage` y `RegisterPage`: popup → idToken → `authApi.loginWithGoogle` → `setAuth` → navigate
- `frontend/src/api/auth.api.ts` — nuevo método `loginWithGoogle(idToken)` → `POST /auth/google`
```ts
const credential = await signInWithPopup(firebaseAuth, googleAuthProvider);
const idToken = await credential.user.getIdToken();
const result = await authApi.loginWithGoogle(idToken);
setAuth(result.accessToken, result.user);
```
- **Visual:** los 3 archivos como cajas conectadas + el fragmento de código
- **Nota:** el mismo botón sirve para login y registro — da igual desde dónde se entre, el backend decide si crea la cuenta o no.

## Slide 6 — Backend: encaja en Hexagonal como un caso de uso más
| Pieza | Archivo | Rol |
|---|---|---|
| Puerto **in** | `core/ports/in/auth/login-with-google.port.ts` | Contrato `execute({ idToken })` |
| Caso de uso | `core/application/use-cases/auth/login-with-google.use-case.ts` | Orquesta verificación, alta/vinculación y emisión de JWT |
| Puerto **out** | `core/ports/out/google-token-verifier.port.ts` | `verify(idToken) → { email, fullName, emailVerified }` |
| Adaptador **out** | `adapters/out/auth/firebase-google-token.adapter.ts` | Verifica el JWT con `jose` contra el JWKS de Google |
| Adaptador **in** | `adapters/in/http/controllers/auth.controller.ts` + `dto/auth/google-login.dto.ts` | `POST /auth/google` |
| Wiring | `bootstrap/auth.module.ts`, `bootstrap/core-infra.module.ts` | Tokens `LOGIN_WITH_GOOGLE` y `GOOGLE_TOKEN_VERIFIER` |
- **Visual:** hexágono con el controller entrando (IN), el verificador saliendo (OUT), el caso de uso en el centro
- **Nota:** el caso de uso no importa `jose`, ni `firebase-admin`, ni nada de Google: solo conoce la interfaz `GoogleTokenVerifierPort`. Reusa 3 puertos que ya existían: `USER_REPOSITORY`, `PASSWORD_HASHER`, `TOKEN_SERVICE`.

## Slide 7 — Verificación del token sin `firebase-admin`
```ts
const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const result = await jwtVerify(idToken, this.jwks, {
  issuer: `https://securetoken.google.com/${projectId}`,
  audience: projectId,
});
```
- Google publica sus claves públicas (JWKS, RS256) — `jose` las descarga y cachea con `createRemoteJWKSet`
- Se valida **firma + issuer + audience + expiración** → lo mismo que hace `firebase-admin`, sin service account
- Único dato necesario: `FIREBASE_PROJECT_ID` (público, ya visible en la config del frontend)
- Token inválido/expirado o sin email → `InvalidCredentialsError` (mismo error que un password incorrecto)
- **Visual:** el JWT descompuesto (header / payload con `iss`, `aud`, `email`, `email_verified` / firma) y la flecha hacia el JWKS
- **Nota:** decisión deliberada: `firebase-admin` pesa mucho y exige credenciales privadas; para *solo verificar* tokens, Google documenta esta alternativa ligera.

## Slide 8 — Caso de uso: alta, vinculación y emisión de JWT
```ts
const identity = await this.googleVerifier.verify(input.idToken);
if (!identity.emailVerified) throw new InvalidCredentialsError(...);

let user = await this.users.findByEmail(identity.email);
if (!user) {
  const unusablePassword = await this.passwordHasher.hash(randomUUID());
  user = await this.users.create({ email, passwordHash: unusablePassword, fullName, role: Role.USER });
}
const accessToken = await this.tokenService.sign({ sub: user.id, email: user.email, role: user.role });
```
- **Cuenta nueva:** se crea con un `passwordHash` aleatorio e inutilizable → `LoginUserUseCase` la rechaza sola si alguien intenta entrar por contraseña; no hubo que tocar ese caso de uso, el repo ni el schema (`passwordHash` sigue `NOT NULL`)
- **Cuenta existente con el mismo email:** se vincula por email (Google ya lo verificó) — coherente con la política de unicidad de email del sistema
- **Salida:** el mismo `LoginUserResult` del login normal → `JwtAuthGuard` y el resto de la app no distinguen el origen
- **Visual:** diagrama de decisión: ¿email verificado? → ¿existe usuario? → crear / vincular → firmar JWT
- **Nota:** el truco del password aleatorio es lo que permite integrar sin migración de DB.

## Slide 9 — Configuración y despliegue
- Backend: `FIREBASE_PROJECT_ID` en `.env` y `docker-compose.yml` (sin secretos)
- Frontend: `VITE_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID` en `frontend/.env` y `docker-compose.yml`
- Regla: `VITE_FIREBASE_PROJECT_ID` (frontend) **debe coincidir** con `FIREBASE_PROJECT_ID` (backend) — es el `audience` del token
- En consola Firebase: habilitar proveedor Google + agregar `localhost` a dominios autorizados
- Dependencia nueva: `firebase` (frontend). Backend reusa `jose` (ya presente)
- **Visual:** tabla de variables de entorno + captura de la consola de Firebase con el proveedor Google habilitado
- **Nota:** si el `projectId` no coincide, el backend responde "Token de Google inválido o expirado" — es el error más común al configurar.

## Slide 10 — Cierre y decisiones de diseño
- **Se agregó:** 1 puerto in, 1 puerto out, 1 caso de uso, 1 adaptador, 1 endpoint, 1 botón
- **No se tocó:** login por password, `JwtAuthGuard`, repositorio de usuarios, schema de DB
- Puerto **específico de Google** a propósito: no se generalizó a un `SocialAuthPort` común (Facebook se desarrolla en paralelo por otro integrante) — unificar es un refactor deliberado posterior, no una abstracción prematura
- *"Firebase autentica; nuestro backend verifica y emite su propio JWT."*
- Gracias / preguntas
- **Visual:** frase-hilo grande + lista corta "agregado / no tocado"

---

## Anexo A — Demo en vivo (2 min)

1. Abrir `http://localhost:5173/login` → clic en "Continuar con Google"
2. Elegir cuenta en el popup → redirige a `/sucursales` ya logueado
3. Mostrar en DevTools → Network el `POST /auth/google` con `{ idToken }` y la respuesta `{ accessToken, user }`
4. (Opcional) Pegar el `idToken` en jwt.io y señalar `iss`, `aud`, `email`, `email_verified`
5. (Opcional) Cerrar sesión, intentar login por contraseña con ese email → "credenciales inválidas" (password inutilizable)

Preparación: `docker compose up -d`, `.env` con `FIREBASE_PROJECT_ID`, consola Firebase con `localhost` autorizado.

## Anexo B — Orden de archivos para code walkthrough

1. `frontend/src/components/auth/GoogleAuthButton.tsx`
2. `frontend/src/lib/firebase.ts`
3. `frontend/src/api/auth.api.ts`
4. `backend/src/adapters/in/http/controllers/auth.controller.ts`
5. `backend/src/core/ports/in/auth/login-with-google.port.ts`
6. `backend/src/core/application/use-cases/auth/login-with-google.use-case.ts`
7. `backend/src/core/ports/out/google-token-verifier.port.ts`
8. `backend/src/adapters/out/auth/firebase-google-token.adapter.ts`
9. `backend/src/bootstrap/auth.module.ts` + `core-infra.module.ts`

## Anexo C — Preguntas esperables

| Pregunta | Respuesta corta |
|---|---|
| ¿Por qué no usar `firebase-admin`? | Solo necesitamos *verificar* tokens; `jose` + JWKS público hace lo mismo sin service account ni credenciales privadas. |
| ¿El `apiKey` de Firebase en el repo no es una fuga? | No: es un identificador público por diseño; la protección es la restricción por dominio en la consola. |
| ¿Qué pasa si alguien manda un token falso? | `jwtVerify` falla en firma/issuer/audience → `InvalidCredentialsError`, mismo error que un password incorrecto. |
| ¿Y si el usuario ya tenía cuenta con ese email? | Se vincula por email, porque Google garantiza que es del usuario (`email_verified`). |
| ¿Puede entrar por contraseña una cuenta creada con Google? | No: el `passwordHash` es un UUID aleatorio hasheado, nadie lo conoce. Habría que agregar un flujo "establecer contraseña" a futuro. |
| ¿Por qué no un `SocialAuthPort` genérico para Google y Facebook? | Para no forzar una abstracción compartida antes de tener ambas implementaciones; unificar es un refactor posterior. |
| ¿Por qué el backend emite su propio JWT y no usa el de Firebase? | Para que el resto de la app (guard, casos de uso) no dependa de Firebase; el token de Firebase dura 1 h y tiene claims propios. |
| ¿Se refresca el token? | No en este alcance: el `accessToken` propio expira según `JWT_EXPIRES_IN` (8 h por defecto), igual que el login normal. |

## Timing de respaldo

| Slides | Tiempo |
|---|---|
| 1-3 (contexto) | ~2 min |
| 4 (flujo) | ~1.5 min |
| 5-6 (frontend + hexagonal) | ~2 min |
| 7-8 (verificación + caso de uso) | ~2.5 min |
| 9-10 (config + cierre) | ~1.5 min |
| **Total** | **~9.5 min** |

Si aprieta el tiempo: recortar la 9 a una frase y la 5 a solo el fragmento de código. Irrecortables: 4, 7 y 8.
