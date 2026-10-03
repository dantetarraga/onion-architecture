# Login con Facebook (sin Firebase)

Cómo se implementó el botón "Continuar con Facebook": por qué no se reutilizó Firebase, cómo se
verifica un token que no se puede verificar en local, y por qué este proveedor sí obliga a guardar
un secreto en el backend.

| | |
|---|---|
| Rama | `feat/auth-facebook` |
| Alcance | 22 archivos · 9 nuevos, 13 modificados (backend + frontend + config) |
| Hermano | [`login-google-firebase.md`](login-google-firebase.md) |

## La idea en una línea

Facebook autentica al usuario **en el navegador** y devuelve un access token; el backend **le pregunta
a Facebook** si ese token es válido y de quién es, y a cambio emite el mismo `accessToken` JWT que ya
emitía el login con email + password. De ahí hacia adentro, nada en la aplicación sabe que Facebook
existe.

## El camino de un login

```
NAVEGADOR   [Continuar con Facebook] ──> FB.login({ scope: 'public_profile,email' })
                                                   │
                                       diálogo de Facebook ──> authResponse.accessToken
                                                   │
                                                   ▼
                                       POST /auth/facebook { accessToken }
                                                   │
API                                    AuthController.loginWithFacebookProvider
                                                   │
                                       LoginWithFacebookUseCase
                                          │                    │
                    FacebookTokenVerifierPort              UserRepositoryPort
                                          │                    │
                    FacebookGraphTokenAdapter            findByEmail / create
                       1) GET /debug_token                     │
                       2) GET /me                              │
                                          │                    ▼
                                          └──────────>  TokenPort.sign(...)
                                                   │
NAVEGADOR   <── 200 { accessToken, user } ─────────┘
                     │
                     └──> useAuthStore.setAuth(...)  →  navigate(from ?? '/sucursales')
```

Es el mismo dibujo que el de Google con una sola caja distinta: la del adaptador. Desde `setAuth` en
adelante el usuario es indistinguible de uno que entró con password.

## Por qué no Firebase

Firebase soporta Facebook como proveedor, y usarlo habría sido casi gratis: el ID token que emite es
el mismo formato que el de Google, así que `FirebaseGoogleTokenAdapter` lo habría validado **sin
cambios**. Se descartó a propósito por dos razones:

- **Es más honesto con el requisito.** "Dos redes sociales" con Firebase de intermediario en ambas es
  un solo mecanismo de integración usado dos veces. Yendo directo a Facebook hay dos formas
  realmente distintas de verificar una identidad federada, que es lo interesante de comparar.
- **Quita un intermediario.** La app habla con Facebook, no con Google que habla con Facebook.

El costo de esa decisión está en la sección de configuración: aquí sí hay un secreto que repartir.

## La diferencia que manda en todo el diseño

Google (vía Firebase) emite un **JWT firmado**. El backend descarga una vez las claves públicas
(JWKS), las cachea, y a partir de ahí verifica cada login **en local**, con matemática: si la firma
cuadra, el token es auténtico. Cero red por login.

Facebook emite un **token opaco**: una cadena sin estructura ni firma que se pueda comprobar. No hay
nada que verificar en local, así que la única opción es preguntarle al emisor. De ahí que este
adaptador haga **dos llamadas HTTP en cada login** donde el de Google no hace ninguna.

Esa asimetría es la razón de que los dos puertos no se hayan unificado en un `SocialAuthPort` común
(ver la nota que ya estaba en `google-token-verifier.port.ts`): no comparten firma —`verify(idToken)`
frente a `verify(accessToken)`— ni el contrato de "correo verificado".

## Backend

### 1. Puerto de salida — `core/ports/out/facebook-token-verifier.port.ts` (nuevo)

```ts
export interface FacebookTokenVerifierPort {
  verify(accessToken: string): Promise<FacebookIdentity>; // { email, fullName, facebookUserId }
}
```

El símbolo `FACEBOOK_TOKEN_VERIFIER` se registró en `core/ports/out/tokens.ts`, junto a
`GOOGLE_TOKEN_VERIFIER`.

`facebookUserId` se devuelve pero **no se persiste**: la identidad se ancla al email, igual que con
Google. Está ahí porque el adaptador ya lo tiene y sería el candidato natural a `provider_id` el día
que haga falta.

### 2. Adaptador — `adapters/out/auth/facebook-graph-token.adapter.ts` (nuevo)

Dos llamadas a la Graph API, en este orden:

**a) `GET /{version}/debug_token?input_token=<token>&access_token=<APP_ID>|<APP_SECRET>`**

Devuelve los metadatos del token. Se valida:

- `is_valid` — que el token exista y no esté revocado,
- **`app_id` — que el token haya sido emitido para *nuestra* app**,
- `expires_at` — que no esté vencido (`0` significa que no expira).

El chequeo de `app_id` es el que realmente sostiene la seguridad de este flujo, y es fácil de
olvidar porque todo "funciona" sin él. Sin ese chequeo, cualquiera puede crear su propia app de
Facebook, conseguir de sus propios usuarios un token perfectamente válido, mandárnoslo, y entrar
como esa persona: el token *es* auténtico, solo que no era para nosotros.

**b) `GET /{version}/me?fields=id,name,email&access_token=<token>&appsecret_proof=<proof>`**

Donde `appsecret_proof` es el HMAC-SHA256 del access token usando el app secret como clave. Facebook
lo recomienda para que un token robado no baste por sí solo: hace falta también conocer el secreto.

**Sobre el correo:** Facebook no expone un flag `email_verified` como Google. Solo devuelve correos
que ya confirmó, así que **la presencia del campo es la verificación** — por eso el caso de uso no
tiene el chequeo de `emailVerified` que sí tiene el de Google. El correo puede no llegar: si la
cuenta se creó con un número de teléfono, o si el usuario desmarcó el permiso en el diálogo. En ese
caso el login se rechaza con un mensaje que dice qué pasó.

**Mapeo de errores.** Todo fallo de verificación (token inválido, de otra app, expirado, sin correo,
un 500 de Facebook, la red caída) se traduce a `InvalidCredentialsError`, que `DomainExceptionFilter`
mapea a **401** (`code: INVALID_CREDENTIALS`) — el mismo cuerpo de error que un password equivocado,
sin filtrar cuál de todas fue la causa.

La falta de `FACEBOOK_APP_ID` o `FACEBOOK_APP_SECRET` sí lanza un `Error` normal (**500**): es un
error de configuración del servidor, no una credencial inválida del usuario. Mismo criterio que el
adaptador de Google con `FIREBASE_PROJECT_ID`.

### 3. Caso de uso — `core/application/use-cases/auth/login-with-facebook.use-case.ts` (nuevo)

```
verify(accessToken)  →  findByEmail(email)
                              │
                              ├── existe   → se reutiliza (vinculación por email)
                              └── no existe → create(...) con password inutilizable
                                            │
                                   tokenService.sign({ sub, email, role })
```

Gemelo de `LoginWithGoogleUseCase`, con las mismas tres decisiones:

- **Es login *y* registro a la vez.** Si el email no existe se crea la cuenta con `Role.USER`. Por eso
  el botón es idéntico en `LoginPage` y `RegisterPage`.
- **Vinculación por email.** Y ahora tiene un caso nuevo que Google no tenía: si alguien ya entró con
  **Google** usando `ana@gmail.com` y después entra con **Facebook** con ese mismo correo, cae en
  *esa misma* cuenta, con sus reservas y su historial. Es la consecuencia deseada de la política de
  unicidad de email: una persona, una cuenta, entre por donde entre.
- **Password inutilizable en cuentas nuevas.** Se guarda `hash(randomUUID())`, así `LoginUserUseCase`
  rechaza esa cuenta por credenciales inválidas sin tocarlo y `passwordHash` sigue siendo `NOT NULL`.

**Cero cambios en la base de datos.** No hay migración de Prisma, ni columnas nuevas, ni cambios en
`UserRepositoryPort`. El resultado es un `LoginUserResult`, el mismo tipo que devuelven los otros dos
logins.

### 4. Entrada HTTP — `adapters/in/http/`

- `dto/auth/facebook-login.dto.ts` (nuevo): `{ accessToken: string }` con `@IsString() @MinLength(10)`.
- `controllers/auth.controller.ts`: nuevo `POST /auth/facebook`, inyectando `LOGIN_WITH_FACEBOOK`.

### 5. Cableado — `bootstrap/`

- `auth.module.ts`: registra `LoginWithFacebookUseCase` y lo publica como `LOGIN_WITH_FACEBOOK`.
- `core-infra.module.ts`: `{ provide: FACEBOOK_TOKEN_VERIFIER, useClass: FacebookGraphTokenAdapter }`,
  en `providers` y en `exports`.

**El backend no suma ni una dependencia.** `fetch` es global desde Node 18 y el HMAC sale de
`node:crypto`. Nada de `axios`, `passport-facebook` ni el SDK de Facebook para servidor.

## Frontend

### `src/lib/facebook.ts` (nuevo)

Facebook no tiene un `initializeApp` como Firebase, así que este módulo cumple el papel de
`src/lib/firebase.ts`: inyecta el `<script>` del SDK una sola vez (la promesa queda memoizada, para
que dos clics seguidos no carguen el script dos veces), llama a `FB.init` con
`VITE_FACEBOOK_APP_ID`, y expone una única función:

```ts
signInWithFacebook(): Promise<string>   // resuelve con el access token
```

Envuelve el `FB.login` de callbacks en una promesa. Si el usuario cierra el diálogo o no autoriza,
`status` no es `'connected'` y la promesa rechaza con *"Inicio de sesión con Facebook cancelado"* en
vez de un error críptico. Si falta `VITE_FACEBOOK_APP_ID`, rechaza diciendo exactamente eso.

Los tipos del SDK van en `src/types/facebook-sdk.d.ts`, una declaración mínima escrita a mano — solo
lo que se usa (`init`, `login`) — para no añadir `@types/facebook-js-sdk`.

### `src/components/auth/FacebookAuthButton.tsx` (nuevo)

Calcado de `GoogleAuthButton`, con el mismo flujo de 5 pasos:

1. `signInWithFacebook()` → abre el diálogo.
2. `authApi.loginWithFacebook(accessToken)` → `POST /auth/facebook`.
3. `setAuth(accessToken, user)` en el store de Zustand.
4. `navigate(location.state?.from ?? '/sucursales', { replace: true })`.
5. Errores → `notifyError`, el mismo canal de avisos del resto de la app.

El logo va como SVG inline, para no depender de un asset externo.

### Resto

- `src/api/auth.api.ts`: `loginWithFacebook(accessToken)`.
- `LoginPage.tsx` y `RegisterPage.tsx`: los dos botones ahora van apilados bajo **un solo** separador
  "o", no uno por botón.
- `src/lib/axios.ts`: el interceptor hacía `logout()` ante cualquier 401 salvo en `/auth/login`. Se
  amplió la excepción a `/auth/`, para que un login social rechazado no dispare un logout inútil.
  Cubre de paso el mismo detalle que ya tenía `/auth/google`.
- **El frontend tampoco suma dependencias**: el SDK se carga por `<script>` en runtime.

## Configuración

Backend (`.env`):

```
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_GRAPH_VERSION=v21.0
```

Frontend (`.env` de la raíz para Docker Compose, `frontend/.env` para `npm run dev`):

```
VITE_FACEBOOK_APP_ID=
VITE_FACEBOOK_GRAPH_VERSION=v21.0
```

`VITE_FACEBOOK_APP_ID` y `FACEBOOK_APP_ID` **deben coincidir**: si no, el chequeo de `app_id` contra
`/debug_token` falla y todo login con Facebook devuelve 401. Es la misma trampa que la de hacer
coincidir los `projectId` de Firebase.

**Sobre el `FACEBOOK_APP_SECRET`:** a diferencia de todo lo de Firebase, este **sí es un secreto de
verdad**. El `apiKey` de Firebase Web es público por diseño y el `projectId` también, por eso están
commiteados con valores reales. El app secret de Facebook, en cambio, permite actuar en nombre de la
aplicación: no va al repo, va en el `.env` local de cada integrante, copiado de la consola de
Facebook.

Por eso **estas variables no tienen valor por defecto** en `docker-compose.yml`, y `docker compose up
--build` ya no deja el login con Facebook funcionando "sin configurar nada" como pasaba con Google.
El resto de la aplicación arranca igual; solo ese botón queda inactivo hasta rellenar el `.env`.

### En la consola de Facebook

En [developers.facebook.com](https://developers.facebook.com) → crear una app de tipo **Consumidor**
→ añadir el producto **Facebook Login** → *Configuración web*:

- **Site URL** `http://localhost:5173`, **App Domains** `localhost`.
- Copiar **App ID** y **App Secret** de *Configuración → Básica* al `.env`.
- La app queda en **modo Desarrollo**: solo entran las cuentas con rol en ella. Añadir a los
  integrantes en *Roles* (administrador, desarrollador o tester).

## Probarlo

1. Rellenar `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` y `VITE_FACEBOOK_APP_ID` en el `.env`.
2. `docker compose up --build`, o el quick start local del README.
3. Ir a http://localhost:5173/login → deben verse los dos botones bajo un único separador "o" →
   **Continuar con Facebook** → autorizar.
4. Debe redirigir a `/sucursales` ya logueado; en la BD aparece un usuario con ese correo y
   `role = USER`.
5. Volver a entrar con la misma cuenta reutiliza el usuario, no crea otro.
6. Si el correo de Facebook coincide con una cuenta que ya existía (por Google o por password), entra
   a *esa* cuenta y ve sus reservas.
7. El login normal con ese correo y cualquier password devuelve 401.
8. `POST /auth/facebook` con un token inventado, desde Swagger (http://localhost:3000/docs), devuelve
   **401 `INVALID_CREDENTIALS`** — no un 500 ni un stack trace.

## Qué queda fuera

- No hay tests automatizados del caso de uso ni del adaptador (habría que levantar un doble de la
  Graph API).
- No hay desvinculación de la cuenta de Facebook ni "establecer contraseña" para cuentas creadas por
  este flujo.
- No se guarda el `facebookUserId` ni la foto de perfil: la identidad se ancla solo al correo.
- La app está en **modo Desarrollo**. Abrirla al público exigiría pasar el **App Review** de
  Facebook para el permiso `email`.
- No se pidió `re_authentication` ni se comprueba la antigüedad del token más allá de `expires_at`.
