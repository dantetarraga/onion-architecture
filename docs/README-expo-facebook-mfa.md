# Exposición — Login con Facebook + Verificación en dos pasos (Google Authenticator)

Guía para exponer, pensada para que la entienda alguien que no programa. Cada parte tiene primero
una explicación en palabras simples y después el fragmento de código que la respalda.

---

## 0. La idea en 30 segundos

Entrar a la app es como entrar a un edificio con dos controles:

| Control | Pregunta que responde | Cómo lo hacemos |
|---|---|---|
| **Primer factor** | *¿Quién eres?* | Contraseña, **o** tu cuenta de Facebook |
| **Segundo factor (MFA)** | *¿Tienes tu celular?* | Un código de 6 dígitos que muestra la app **Google Authenticator** |

Pase por donde pase (contraseña o Facebook), al final **nuestro servidor** entrega un "pase de
acceso" propio (un *token*). El resto de la app solo mira ese pase: no sabe ni le importa cómo entraste.

> **Google Authenticator no necesita cuenta de Google.** Es solo una app que hace una cuenta
> matemática con un secreto y la hora. Nuestro servidor hace la misma cuenta. Si los dos números
> coinciden, eres tú. No hay internet de por medio entre la app y nosotros.

---

## 1. Flujo completo (diagrama)

```
                 ¿QUIÉN ERES?  (primer factor)

   [Continuar con Facebook]                 [Correo + contraseña]
            │                                        │
            ▼                                        │
   Se abre la ventanita de Facebook                  │
   el usuario acepta → Facebook entrega              │
   un "comprobante" (token de Facebook)              │
            │                                        │
            ▼                                        ▼
   Nuestro servidor le pregunta a Facebook:   Nuestro servidor compara la
   "¿este comprobante es real y es de mi      contraseña con la guardada
    app? ¿de quién es?"                              │
            │                                        │
            ▼                                        │
   Si el correo no existe, crea la cuenta            │
            │                                        │
            └──────────────┬─────────────────────────┘
                           ▼
              ¿Este usuario activó la verificación en dos pasos?
                           │
            ┌──────────────┴──────────────┐
           NO                             SÍ
            │                              │
            ▼                              ▼
   Entrega el pase de acceso      Entrega un "pase provisional" de 5 minutos
   → el usuario ya está dentro    que SOLO sirve para el siguiente paso
                                           │
                 ¿TIENES TU CELULAR?  (segundo factor)
                                           │
                                           ▼
                            Pantalla: "Ingresa el código de la app"
                            El usuario abre Google Authenticator → ve 6 dígitos
                                           │
                                           ▼
                            El servidor calcula el código que DEBERÍA ser
                            y lo compara con el que escribió el usuario
                                           │
                             ┌─────────────┴─────────────┐
                        coincide                    no coincide / ya usado
                             │                              │
                             ▼                              ▼
                  Entrega el pase de acceso        "Código inválido"
                  → el usuario ya está dentro
```

### Activar la verificación (se hace una sola vez, en la pantalla *Seguridad*)

```
1. El usuario pulsa "Activar"
2. El servidor inventa un secreto y lo muestra como código QR
3. El usuario escanea el QR con Google Authenticator → la app empieza a mostrar códigos
4. El usuario escribe el primer código → si es correcto, queda activado
5. Se le dan 8 "códigos de respaldo" por si pierde el celular (se muestran una sola vez)
```

### ¿Cómo saben los dos el mismo número sin hablarse?

```
Ingredientes:  el SECRETO (compartido al escanear el QR)  +  la HORA (redondeada a 30 segundos)
Receta:        mezclar ambos con una función matemática → salen 6 dígitos
```
El celular y el servidor tienen los mismos ingredientes y la misma receta → el mismo resultado.
Cada 30 segundos la hora cambia, así que el código cambia. Por eso un código viejo no sirve.

---

## 2. Las partes clave del código

### 2.1 Un solo "portero" para todas las formas de entrar
**En palabras simples:** no importa si entraste con contraseña o con Facebook: al final, todos los
caminos pasan por la misma función, que decide si te deja entrar directo o te pide el código.

`backend/src/core/application/use-cases/auth/issue-session.ts`
```ts
export async function issueSession(tokenService, user) {
  if (user.mfaEnabled) {
    // Tiene 2 pasos activado → pase provisional de 5 min, solo sirve para pedir el código
    return { mfaRequired: true, mfaToken: await tokenService.signMfaChallenge(user.id) };
  }
  // No tiene 2 pasos → pase de acceso completo
  return issueAccessSession(tokenService, user);
}
```
> **Por qué importa:** si mañana agregamos "entrar con Apple", hereda la verificación en dos pasos
> sin escribir nada más. Los tres logins terminan con la misma línea: `return issueSession(...)`.

### 2.2 Facebook — el navegador consigue el comprobante, el servidor lo verifica
**En palabras simples:** usamos la herramienta oficial de Facebook (su *SDK*, un programita que se
carga en la página). Esa herramienta abre la ventanita de Facebook; cuando el usuario acepta, nos
entrega un comprobante. Nosotros **no confiamos** en ese comprobante a ciegas: el servidor le
pregunta a Facebook si es auténtico y de quién es.

`frontend/src/lib/facebook.ts` — en el navegador
```ts
// 1) Cargar la herramienta oficial de Facebook (SDK)
script.src = 'https://connect.facebook.net/es_LA/sdk.js';
window.FB.init({ appId, version: 'v21.0' });

// 2) Abrir la ventanita de Facebook; cuando el usuario acepta, el SDK nos avisa y nos da el comprobante
FB.login((response) => resolve(response.authResponse.accessToken), { scope: 'public_profile,email' });

// 3) Enviar ese comprobante a NUESTRO servidor
await authApi.loginWithFacebook(accessToken);   // POST /auth/facebook
```

`backend/src/adapters/out/auth/facebook-graph-token.adapter.ts` — en el servidor
```ts
// 1) Preguntarle a Facebook: "¿este comprobante es válido y es de MI aplicación?"
GET /debug_token?input_token=<comprobante>&access_token=<appId>|<appSecret>
if (!data.is_valid || data.app_id !== this.appId) throw new InvalidCredentialsError();

// 2) Preguntarle: "¿de quién es?"
GET /me?fields=id,name,email   →  { email, fullName }
```
> **Nota para preguntas:** aquí el servidor sí guarda una clave secreta de Facebook
> (`FACEBOOK_APP_SECRET`), porque Facebook solo responde "¿es válido?" si demuestras ser el dueño de
> la app. Es la única pieza del sistema que sabe que Facebook existe.

### 2.3 Dos tipos de pase, y cómo no confundirlos
**En palabras simples:** el pase provisional (para pedir el código) y el pase de acceso (para usar
la app) están firmados con la misma llave. Para que nadie use el provisional como si fuera el
completo, cada uno lleva escrito "para qué sirve".

`backend/src/adapters/out/auth/jwt-token.adapter.ts`
```ts
sign(...)             → { purpose: 'access', vence en 8 h }   // pase de acceso
signMfaChallenge(id)  → { purpose: 'mfa',    vence en 5 min } // pase provisional

verify(token)         → si purpose ≠ 'access' → rechazar   // el provisional NO abre la app
verifyMfaChallenge(t) → si purpose ≠ 'mfa'    → rechazar   // el completo NO salta el 2do paso
```

### 2.4 La "receta" del código de 6 dígitos
**En palabras simples:** esta es la misma cuenta que hace Google Authenticator. La escribimos
nosotros (son ~40 líneas) para poder explicarla y para no depender de librerías externas.
Está comprobada contra los ejemplos oficiales del estándar (RFC 6238).

`backend/src/adapters/out/auth/rfc6238-totp.adapter.ts`
```ts
function hotp(secreto, paso) {
  const huella = HMAC_SHA1(secreto, paso);         // mezcla secreto + hora → 20 bytes
  const inicio = huella[19] & 0x0f;                // el último byte dice dónde "recortar"
  const numero = leer4bytes(huella, inicio);       // se toman 4 bytes de ese punto
  return (numero % 1_000_000).padStart(6, '0');    // se dejan solo 6 dígitos
}

verify(secreto, codigo) {
  const pasoActual = Math.floor(ahora / 30);       // la hora, en bloques de 30 segundos
  for (paso de pasoActual-1 a pasoActual+1)        // tolera 30 s de reloj desfasado
    if (hotp(secreto, paso) === codigo) return paso;
  return null;                                     // no coincide con ninguno
}
```
> Devuelve **en qué bloque de 30 s** coincidió el código, no solo "sí/no". Eso permite el siguiente punto.

### 2.5 Verificar el código (y que no se pueda reusar)
**En palabras simples:** el servidor revisa el pase provisional, recupera el secreto del usuario,
calcula el código y lo compara. Si coincide, anota "este bloque de tiempo ya se usó" para que el
mismo código no sirva dos veces, y recién entonces entrega el pase de acceso.

`backend/src/core/application/use-cases/auth/verify-mfa.use-case.ts`
```ts
userId = verifyMfaChallenge(mfaToken);                       // 1) ¿pasó el primer factor?
credentials = findMfaCredentials(userId);                    // 2) secreto (cifrado) + último bloque usado
step = totp.verify(cipher.decrypt(secreto), code);           // 3) ¿el código es correcto?
if (step === null || step <= credentials.lastStep) throw;    // 4) incorrecto, o ya usado → rechazar
updateMfa(userId, { lastStep: step });                       // 5) marcar como usado
return issueAccessSession(user);                             // 6) ahora sí: pase de acceso
```

### 2.6 Activar: inventar el secreto y mostrarlo como QR
**En palabras simples:** el servidor genera un secreto al azar, lo guarda **cifrado** (nadie puede
leerlo aunque abra la base de datos) y lo convierte en un texto especial que Google Authenticator
entiende. La pantalla lo dibuja como QR.

`backend/src/core/application/use-cases/auth/setup-mfa.use-case.ts`
```ts
const secret = totp.generateSecret();                                       // 20 bytes al azar
await users.updateMfa(user.id, { enabled: false, totpSecretEnc: cipher.encrypt(secret) });
return { otpauthUri: `otpauth://totp/Parking/OS:${user.email}?secret=${secret}&period=30&digits=6` };
```
`frontend/src/pages/security/SecurityPage.tsx`
```ts
const result = await authApi.setupMfa();
qrDataUrl = await generateQrDataUrl(result.otpauthUri);   // el texto → imagen QR
```
> Queda "sin activar" hasta que el usuario escribe el primer código correcto. Así, si cierra la
> pantalla a medias, no se queda fuera de su cuenta.

### 2.7 En el navegador: a dónde ir después de entrar
**En palabras simples:** los tres botones de login usan esta misma función. Si el servidor respondió
"falta el código", va a la pantalla del código; si respondió con el pase, guarda la sesión y entra.

`frontend/src/hooks/useLoginResult.ts`
```ts
if (result.mfaRequired) {
  navigate('/mfa', { state: { mfaToken: result.mfaToken } });   // pedir el segundo factor
} else {
  setAuth(result.accessToken, result.user);                      // ya está dentro
  navigate('/sucursales');
}
```

### 2.8 Los "puntos de entrada" del servidor (endpoints)

| Endpoint | ¿Quién puede llamarlo? | Qué hace |
|---|---|---|
| `POST /auth/login` | cualquiera | correo + contraseña → pase o "falta el código" |
| `POST /auth/facebook` | cualquiera | comprobante de Facebook → pase o "falta el código" |
| `POST /auth/mfa/verify` | cualquiera · máx. 5 intentos/min | pase provisional + código → pase de acceso |
| `POST /auth/mfa/setup` | usuario logueado | genera el secreto y el QR |
| `POST /auth/mfa/confirm` | usuario logueado · 5/min | primer código correcto → activa + códigos de respaldo |
| `DELETE /auth/mfa` | usuario logueado · 5/min | desactiva (pide un código vigente) |

---

## 3. Dónde vive cada cosa

```
backend/src/
  core/application/use-cases/auth/
    issue-session.ts                 ← el "portero" común de los 3 logins
    setup-mfa / confirm-mfa / verify-mfa / disable-mfa.use-case.ts
  core/ports/out/
    totp.port.ts, secret-cipher.port.ts, facebook-token-verifier.port.ts   ← contratos
  adapters/out/auth/
    rfc6238-totp.adapter.ts          ← la "receta" del código
    aes-gcm-secret-cipher.adapter.ts ← cifra el secreto en la base de datos
    facebook-graph-token.adapter.ts  ← verifica el comprobante con Facebook
    jwt-token.adapter.ts             ← los dos tipos de pase
  adapters/in/http/controllers/auth.controller.ts   ← los endpoints
frontend/src/
  hooks/useLoginResult.ts            ← a dónde ir después de entrar
  pages/MfaChallengePage.tsx         ← pantalla /mfa (pedir el código)
  pages/security/SecurityPage.tsx    ← pantalla /seguridad (activar / desactivar)
```

---

## 4. Preguntas que van a hacer (respuestas cortas)

| Pregunta | Respuesta |
|---|---|
| ¿Necesitan cuenta o permisos de Google para esto? | **No.** Google Authenticator es solo una calculadora; el secreto lo genera nuestro servidor. Sirve cualquier app parecida (Microsoft Authenticator, Authy…). |
| ¿Y si alguien roba el pase provisional? | Solo sirve para pedir el código, dura 5 minutos y la app lo rechaza para todo lo demás. |
| ¿Se puede reusar un código que alguien vio? | No: el servidor anota el bloque de 30 s ya usado y rechaza repetirlo. |
| ¿Se puede adivinar probando muchos códigos? | Hay un millón de combinaciones y se permiten 5 intentos por minuto; el código caduca mucho antes. |
| ¿Y si el usuario pierde el celular? | Tiene 8 códigos de respaldo, cada uno sirve una sola vez. |
| ¿Por qué Facebook sí necesita una clave secreta en el servidor? | Porque Facebook solo confirma si un comprobante es válido a quien demuestra ser dueño de la app. |
| ¿Si entro con Facebook también me pide el código? | Sí: todos los caminos pasan por el mismo "portero". |
| ¿Y si el reloj del celular está mal? | Se toleran 30 segundos de diferencia. |

---

## 5. Demo en vivo (2 minutos)

1. Entrar → menú **Seguridad** → **Activar** → escanear el QR con Google Authenticator → escribir el código → **Confirmar**.
2. **Salir** → entrar de nuevo (contraseña o Facebook) → aparece la pantalla del código → escribirlo → entra.
3. Volver a escribir el **mismo** código antes de 30 s → "inválido o ya utilizado".
4. (Opcional, para el jurado técnico) DevTools → Network: la respuesta de `POST /auth/login` trae
   `mfaRequired: true` y **no** trae el pase de acceso.
