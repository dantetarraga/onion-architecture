# Login con Google (Firebase Authentication)

Cómo se implementó el botón "Continuar con Google": qué hace cada archivo, por qué el backend no usa
`firebase-admin`, y cómo la cuenta de Google se vincula con el usuario de siempre.

|         |                                                                      |
| ------- | -------------------------------------------------------------------- |
| Commit  | `9c0c2a5`                                                            |
| Rama    | `feat/auth-google-firebase`                                          |
| Alcance | 20 archivos · 8 nuevos, 12 modificados (backend + frontend + config) |

## La idea en una línea

Firebase autentica al usuario **en el navegador** y devuelve un ID token; el backend **solo verifica
la firma** de ese token y, a cambio, emite el mismo `accessToken` JWT que ya emitía el login con
email + password. De ahí hacia adentro, nada en la aplicación sabe que Google existe.

## El camino de un login

```
NAVEGADOR   [Continuar con Google] ──> signInWithPopup(firebaseAuth, googleAuthProvider)
                                                   │
                                       popup de Google ──> credential.user.getIdToken()
                                                   │
                                                   ▼
                                       POST /auth/google { idToken }
                                                   │
API                                    AuthController.loginWithGoogleProvider
                                                   │
                                       LoginWithGoogleUseCase
                                          │                    │
                     GoogleTokenVerifierPort                UserRepositoryPort
                                          │                    │
                     FirebaseGoogleTokenAdapter          findByEmail / create
                     (jose + JWKS de Google)                    │
                                          │                    ▼
                                          └──────────>  TokenPort.sign(...)
                                                   │
NAVEGADOR   <── 200 { accessToken, user } ─────────┘
                     │
                     └──> useAuthStore.setAuth(...)  →  navigate(from ?? '/sucursales')
```

Desde `setAuth` en adelante el usuario es indistinguible de uno que entró con password: mismo
`accessToken`, mismo `JwtAuthGuard`, mismos roles.

## Backend

### 1. Puerto de salida — `core/ports/out/google-token-verifier.port.ts` (nuevo)

```ts
export interface GoogleTokenVerifierPort {
  verify(idToken: string): Promise<GoogleIdentity> // { email, fullName, emailVerified }
}
```

Es el único punto donde el core nombra a Google. Decisión deliberada: **no** se generalizó a un
`SocialAuthPort` común con otros proveedores (Facebook se estaba desarrollando en paralelo por otro
integrante) para no inventar una abstracción compartida antes de tener dos implementaciones reales.
Unificar login social, si hace falta, es un refactor posterior y explícito.

El símbolo `GOOGLE_TOKEN_VERIFIER` se registró en `core/ports/out/tokens.ts`.

### 2. Adaptador — `adapters/out/auth/firebase-google-token.adapter.ts` (nuevo)

Verifica el ID token contra el JWKS público de Google:

```
https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com
```

usando `jose` (`createRemoteJWKSet` + `jwtVerify`), la misma librería que ya usaba `JwtTokenAdapter`
para los tokens propios. Se valida:

- **firma** RS256 contra las claves públicas de Google (el JWKS se cachea y rota solo),
- **issuer** = `https://securetoken.google.com/<FIREBASE_PROJECT_ID>`,
- **audience** = `<FIREBASE_PROJECT_ID>`,
- expiración (la aplica `jwtVerify`),
- presencia del claim `email`.

**Por qué no `firebase-admin`:** para _verificar_ tokens no hace falta. `firebase-admin` exige una
service account (un secreto que habría que repartir entre los integrantes y sacar del repo) y arrastra
un SDK completo. Con `jose` + JWKS el backend no guarda ningún secreto de Firebase: solo necesita el
`projectId`, que es un dato público ya visible en la config web del frontend.

Cualquier fallo de verificación se traduce a `InvalidCredentialsError`, que `DomainExceptionFilter`
mapea a **401** (`code: INVALID_CREDENTIALS`) — el mismo cuerpo de error que un password equivocado,
sin filtrar si el token estaba expirado, mal firmado o era de otro proyecto.

La falta de `FIREBASE_PROJECT_ID` sí lanza un `Error` normal (500): es un error de configuración del
servidor, no una credencial inválida del usuario.

### 3. Caso de uso — `core/application/use-cases/auth/login-with-google.use-case.ts` (nuevo)

```
verify(idToken)  →  ¿emailVerified?  →  findByEmail(email)
                         │ no                   │
                         ▼                      ├── existe   → se reutiliza (vinculación por email)
                  401 INVALID_CREDENTIALS       └── no existe → create(...) con password inutilizable
                                                              │
                                                     tokenService.sign({ sub, email, role })
```

Tres decisiones que vale la pena señalar:

- **Es login _y_ registro a la vez.** Si el email no existe se crea la cuenta con `Role.USER`; si
  existe, se reutiliza. Por eso el botón es idéntico en `LoginPage` y `RegisterPage`.
- **Vinculación por email.** Si alguien ya se registró con `ana@gmail.com` y password, entrar con
  Google lo deja en _esa misma_ cuenta, con sus reservas y su historial. Google ya verificó el
  correo, y es coherente con la política de unicidad de email del sistema.
- **Password inutilizable en cuentas nuevas.** Se guarda `hash(randomUUID())`: un hash válido de una
  contraseña que nadie conoce ni puede adivinar. Así `LoginUserUseCase` rechaza esa cuenta por
  credenciales inválidas _sin tocarlo_, y `passwordHash` sigue siendo `NOT NULL` en el schema — cero
  cambios en Prisma, en el repositorio y en el login existente.

El resultado es un `LoginUserResult`, **el mismo tipo** que devuelve `LoginUserUseCase`: el frontend
consume ambas respuestas con el mismo código.

### 4. Entrada HTTP — `adapters/in/http/`

- `dto/auth/google-login.dto.ts` (nuevo): `{ idToken: string }` con `@IsString() @MinLength(10)`.
- `controllers/auth.controller.ts`: nuevo `POST /auth/google`, inyectando `LOGIN_WITH_GOOGLE`. Como
  cualquier otro endpoint, el controlador solo delega: no conoce Firebase ni `jose`.

### 5. Cableado — `bootstrap/`

- `auth.module.ts`: registra `LoginWithGoogleUseCase` y lo publica como `LOGIN_WITH_GOOGLE`
  (`core/ports/in/tokens.ts`).
- `core-infra.module.ts`: `{ provide: GOOGLE_TOKEN_VERIFIER, useClass: FirebaseGoogleTokenAdapter }`,
  exportado junto a los demás adaptadores de infraestructura.

Sustituir Firebase por Google Identity, Auth0 o un stub de tests es cambiar esa única línea.

## Frontend

### `src/lib/firebase.ts` (nuevo)

Inicializa la app de Firebase y exporta `firebaseAuth` y `googleAuthProvider`. Toda la config sale de
variables `VITE_FIREBASE_*` en vez de estar hardcodeada, para poder apuntar a otro proyecto por
entorno sin tocar código.

### `src/components/auth/GoogleAuthButton.tsx` (nuevo)

Un solo componente hace el flujo completo:

1. `signInWithPopup(firebaseAuth, googleAuthProvider)` → abre el popup de Google.
2. `credential.user.getIdToken()` → ID token de Firebase.
3. `authApi.loginWithGoogle(idToken)` → `POST /auth/google`.
4. `setAuth(accessToken, user)` en el store de Zustand.
5. `navigate(location.state?.from ?? '/sucursales', { replace: true })` — respeta la ruta desde la
   que el guard redirigió al login, igual que el formulario de password.

Los errores (popup cerrado, token rechazado) van a `notifyError`, el mismo canal de avisos del resto
de la app. El logo de Google va como SVG inline para no depender de un asset externo.

### Resto

- `src/api/auth.api.ts`: `loginWithGoogle(idToken)`.
- `LoginPage.tsx` y `RegisterPage.tsx`: separador "o" + `<GoogleAuthButton />` bajo el formulario.
- `package.json`: `firebase ^12.19.0` (solo en el frontend; el backend no suma dependencias, ya
  tenía `jose`).

## Configuración

Backend (`.env`):

```
FIREBASE_PROJECT_ID=hdlizana
```

Frontend (`.env` de la raíz para Docker Compose, `frontend/.env` para `npm run dev`):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=hdlizana.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=hdlizana
VITE_FIREBASE_STORAGE_BUCKET=hdlizana.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`VITE_FIREBASE_PROJECT_ID` y `FIREBASE_PROJECT_ID` **deben coincidir**: si no, el `audience` del
token no cuadra con el que espera el adaptador y todo login con Google devuelve 401.

Los valores por defecto ya están en `.env.example`, `frontend/.env.example` y `docker-compose.yml`
(servicios `backend` y `frontend`), así que `docker compose up --build` funciona sin configurar nada.

**Sobre el `apiKey` en el repo:** el API key de Firebase Web es público por diseño — viaja en el
bundle de cualquier app Firebase y se restringe por dominio autorizado en la consola, no es un
secreto. El único secreto real de Firebase sería la service account, y este diseño no la usa.

En la consola de Firebase hay que tener habilitado el proveedor **Google** en Authentication, y
`localhost` (más el dominio de despliegue) en _Authorized domains_.

## Probarlo

1. `docker compose up --build`, o el quick start local del README.
2. Ir a http://localhost:5173/login → **Continuar con Google** → elegir cuenta.
3. Debe redirigir a `/sucursales` ya logueado; en la BD aparece un usuario con ese email y `role = USER`.
4. Volver a entrar con la misma cuenta reutiliza el usuario, no crea otro.
5. El login normal con ese email y cualquier password devuelve 401: la cuenta creada por Google no
   tiene una contraseña usable.

## Qué queda fuera

- No hay tests automatizados del caso de uso (probarlo requiere firmar tokens contra un JWKS falso).
- No hay desvinculación de la cuenta de Google ni "establecer contraseña" para cuentas creadas por Google.
- No se guarda el `uid` de Firebase ni la foto de perfil: la identidad se ancla solo al email.
