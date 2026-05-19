# Plan de Preparación para App Store (iOS)

**Fecha:** 2026-05-19
**Estado:** Auditoría completa, plan de fixes priorizado.

## Resumen ejecutivo

El estado actual de la app **NO pasaría el review de Apple**. Hay 1 bloqueante crítico (Apple Sign-In), 3 fixes obligatorios (privacy policy real, microphone permission, placeholders de username), y ~6 ítems de App Store Connect metadata que no son código sino configuración externa.

**Tiempo estimado total para llegar a "submittable":** 1-2 días de trabajo + tiempos de Apple Developer Program ($99 USD, hasta 48h en activarse).

Para llegar a **TestFlight con amigos** (100 usuarios sin App Store público): el subset es más chico — solo Apple Sign-In y un par de quick wins. Lo separo abajo.

---

## 1. Bloqueantes (rechazo seguro)

### 1.1 Apple Sign-In está stubbed (regla 4.8) 🔴

**Archivo:** `src/auth/apple.ts`

Actualmente devuelve `false` y lanza error. Apple exige que si ofrecés cualquier OAuth de terceros (Google, Facebook, etc.), **debes ofrecer también Apple Sign-In** O un email/password tradicional. No tenemos ninguno de los dos.

**Qué hay que hacer:**

1. Instalar `expo-apple-authentication`:
   ```
   pnpm exec expo install expo-apple-authentication
   ```
2. Agregar plugin en `app.json`:
   ```json
   "plugins": [..., "expo-apple-authentication"]
   ```
3. Habilitar capability "Sign In with Apple" en el Apple Developer Portal para `app.stickerswap` (vía Xcode → Signing & Capabilities cuando tengas Developer license).
4. Restaurar `src/auth/apple.ts` con la implementación original (git log: la versión antes del stub). El flow es:
   - `AppleAuthentication.signInAsync({ requestedScopes: [EMAIL, FULL_NAME] })`
   - Pasar el `identityToken` a `supabase.auth.signInWithIdToken({ provider: "apple", token })`
5. Agregar botón "Continuar con Apple" en `app/(auth)/sign-in.tsx`. Solo visible en iOS (`Platform.OS === "ios"` + check `AppleAuthentication.isAvailableAsync()`).
6. Configurar Supabase: dashboard → Authentication → Providers → Apple → habilitar y pegar Service ID + Key ID + Team ID + .p8 key (todo se obtiene del Apple Developer Portal).

**Tiempo:** ~3-4 hs de trabajo + configuración de portales.

### 1.2 Privacy policy y Terms apuntan a `example.com` 🔴

**Archivo:** `app/about.tsx:8-9`

```ts
const PRIVACY_URL = "https://example.com/stickerswap/privacy";
const TERMS_URL = "https://example.com/stickerswap/terms";
```

Apple va a hacer click y va a fallar el link → rechazo automático.

**Qué hay que hacer:**

1. Escribir los textos de privacy + terms. Modelo mínimo para una app que:
   - Guarda email vía Supabase Auth
   - Guarda username, displayName, city, country, contactos (whatsapp/instagram) opcionales en `profiles`
   - Almacena progreso del álbum localmente + sincroniza a Supabase
   - No tiene tracking publicitario, no vende datos
2. Hostear los textos en algún URL público estable. Opciones gratis:
   - GitHub Pages: crear repo `stickerswap-legal`, agregar `privacy.md` + `terms.md`, activar Pages
   - Subdominio propio (ej. `legal.stickerswap.app`)
   - Notion público o similar
3. Reemplazar las constantes con URLs reales en `app/about.tsx`.
4. Bonus: agregar el URL en App Store Connect → App Information → Privacy Policy URL.

**Tiempo:** ~2 hs (escribir + publicar).

### 1.3 Permiso `RECORD_AUDIO` injustificado 🟠

**Archivo:** `app.json:25`

```json
"android": {
  "permissions": [
    "android.permission.CAMERA",
    "android.permission.RECORD_AUDIO"
  ]
}
```

La app no graba audio. `RECORD_AUDIO` probablemente vino auto-incluido por `expo-camera` (modo video). En iOS los permisos se declaran via `infoPlist` y para microphone, si no lo declaramos pero alguna lib lo intenta acceder, **Apple rechaza** ("requested permission not declared" o al revés, "declared but unused").

**Qué hay que hacer:**

1. Verificar si el código usa video/audio en algún flujo de camera scan. Buscar `Camera` usages — el QR scanner debería ser solo foto/video stream sin audio.
2. Si no se usa audio: removerlo de `app.json` Android permissions.
3. Verificar que `expo-camera` no fuerza `NSMicrophoneUsageDescription` en iOS. Si lo agrega automáticamente, configurar el plugin para deshabilitarlo:
   ```json
   ["expo-camera", { "cameraPermission": "...", "microphonePermission": false }]
   ```
4. Re-prebuild iOS para que el `Info.plist` quede sin la entrada de microphone:
   ```
   pnpm exec expo prebuild --platform ios --clean
   ```

**Tiempo:** ~30 min.

---

## 2. Riesgo medio (probable observación o rechazo)

### 2.1 Placeholders mencionan "panini" 🟡

**Archivos:**
- `app/add-friend/search.tsx:58` — placeholder `oscar_panini`
- `app/(auth)/onboarding.tsx:91` — placeholder `oscar_panini`

Apple no monitorea marcas registradas de forma proactiva, **pero**: una vez en la tienda, Panini (la editorial) PUEDE reportarte por uso de marca. Suficiente para que Apple te baje la app.

**Qué hay que hacer:**

1. Reemplazar `oscar_panini` por `usuario_demo`, `oscar_22`, o algo neutro.
2. (Opcional) Renombrar variables internas `panini.db`, `panini.theme.mode`, etc. NO son user-facing, no son issue legal — pero si lo querés limpio, hay que migrar el SQLite file y AsyncStorage keys con un script de migración. Más esfuerzo del que vale.

**Tiempo:** ~10 min para los placeholders user-facing.

### 2.2 Branding del álbum: "FIFA World Cup 2026" / Panini 🟡

**Archivo:** `assets/stickers.json` — el header dice `"album": "FIFA World Cup 2026"`.

FIFA y Panini son marcas registradas. La app implícitamente referencia los cromos oficiales por número.

**Qué hay que hacer (mitigación, no fix completo):**

1. Cambiar el header del dataset a `"album": "Mundial 2026"` (sin FIFA). Internal-only string, fácil.
2. En App Store Connect: descripción de la app NO debe usar "Panini", "FIFA", "World Cup". Usar "Mundial 2026", "tu álbum de cromos".
3. Nombre de la app: `StickerSwap` es OK. No mencionar las marcas en el subtítulo/keywords.
4. Si Panini te reporta, la app baja. Para reducir el riesgo: no usar gráficos Panini, no usar fotos de cromos. La app actual no las usa (solo iniciales de jugadores) — bien.

**Tiempo:** ~10 min para el header. La estrategia de branding es decisión tuya.

### 2.3 Sign-in screen no menciona la política de privacidad de forma clara 🟡

**Archivo:** `app/(auth)/sign-in.tsx:59` — usa `t("signIn_terms")`.

Apple requiere que antes de cualquier registro/login el usuario sepa qué acepta. Hay que confirmar que `signIn_terms` contiene texto que linkea a privacy/terms (no solo dice "al continuar aceptás los términos" sin links).

**Qué hay que hacer:**

1. Abrir `src/i18n/locales/es.json` (o el archivo de strings) y verificar que `signIn_terms` tenga: "Al continuar aceptás los Términos y la Política de privacidad" con texto clickeable que abra los URLs reales (post-fix de 1.2).
2. Si no es clickeable, refactorizar a un componente que renderiza Pressables con los links.

**Tiempo:** ~30 min.

---

## 3. Setup externo obligatorio (sin código)

### 3.1 Apple Developer Program ($99 USD/año) 🔴

- Comprar en https://developer.apple.com
- Activación: hasta 48 horas con verificación de identidad
- Sin esto, no podés ni siquiera firmar con tu Apple ID para distribución

### 3.2 App Store Connect setup

Después de tener Developer Program:

- Crear app en App Store Connect con bundle ID `app.stickerswap`
- Subir certificados, provisioning profiles (EAS Build lo hace automático)
- Crear listing: nombre, subtítulo, descripción, keywords, categoría (Lifestyle o Entertainment), age rating
- Privacy questionnaire (App Privacy section): declarar
  - **Email Address** — Auth, linkeada a usuario, NO usada para tracking
  - **Name** — Display Name, opcional, linkeada al usuario
  - **User ID** — Username/UUID, linkeada al usuario
  - **Coarse Location** — City label (opcional, solo si activan "discoverable")
  - **Contact info (other)** — WhatsApp/Instagram opcional
  - Nada de tracking, ads, analytics third-party
- Subir screenshots: 6.5" iPhone (iPhone 11 Pro Max o similar) y opcional iPad
  - Mínimo 3, ideal 6-10 screenshots por idioma
- Subir App Icon 1024×1024 (sin alpha)

**Tiempo:** ~3-4 hs entre llenar formularios + producir screenshots.

### 3.3 Datos para review de Apple

En App Store Connect → App Review Information:

- **Test account**: crearle a Apple un user demo con email/password (post-Apple Sign-In, también pueden usar Apple test account)
- **Demo data**: cuenta con stickers ya marcados, amigos, matches para que vean la app funcionando
- **Notes**: explicar el flow ("crear cuenta → onboarding → tab Home muestra dashboard, tap en equipos los expande, etc."). Apple no juega, solo verifica que las features anunciadas funcionan.

**Tiempo:** ~1 hora.

### 3.4 EAS Build configurado para iOS Production

Actualmente tenés EAS configurado (`projectId: 7f4acc0f-...`). Falta:

- `eas.json` con perfil `production` para iOS
- `eas build --platform ios --profile production` → genera `.ipa` firmado
- `eas submit --platform ios` → sube directo a App Store Connect

**Tiempo:** ~1 hora primera vez (firma + tarifa), después es 1 comando.

---

## 4. Quick wins inmediatos (código)

Hagamos en orden:

| # | Acción | Archivo | Tiempo |
|---|---|---|---|
| 1 | Cambiar placeholders `oscar_panini` → `oscar_demo` | `app/add-friend/search.tsx`, `app/(auth)/onboarding.tsx` | 5 min |
| 2 | Cambiar `album: "FIFA World Cup 2026"` → `"Mundial 2026"` | `scripts/gen-stickers.js` + regen | 5 min |
| 3 | Remover `RECORD_AUDIO` y `microphonePermission` de plugin | `app.json` | 5 min |
| 4 | Privacy/Terms: escribir + hostear → reemplazar URLs | `app/about.tsx` + URL externo | 2 h |
| 5 | Restaurar Apple Sign-In | `src/auth/apple.ts`, `app/(auth)/sign-in.tsx` | 3 h |
| 6 | Hacer clickeable los links de terms en sign-in | i18n strings + componente | 30 min |

**Total código: ~6 horas.**

---

## 5. Camino más corto: TestFlight para amigos

Si solo querés que tus amigos prueben la app antes de publicación pública, **TestFlight Internal Testing** te sirve y se salta la mayoría del proceso:

- **Necesario**: Apple Developer ($99), build firmada subida vía EAS, agregar Apple IDs de amigos como Internal Testers (hasta 100).
- **NO necesario**: privacy policy real (se puede usar placeholder), Apple Sign-In (recomendable pero no bloqueante para internal), App Privacy questionnaire (solo para External Testing).
- **Tiempo desde 0**: ~1 día (esperando activación de Developer Program la mitad de ese tiempo).

**Subset de quick wins para TestFlight Internal:**
- Item 3 (microphone permission) — para que el build pase sin warnings raros.
- Items 1, 2 (placeholders + branding) — limpieza menor pero importante.
- Apple Sign-In: opcional para internal testing, **obligatorio** si pasás a External (review) o Production.

Si la idea es solo "que mis 10 amigos lo prueben en su iPhone físico", apunta a Internal Testing. Si querés que CUALQUIERA pueda bajar la app, vas full review.

---

## 6. Orden recomendado de ejecución

1. **Comprar Apple Developer Program** (mientras esperás la activación de 48h, hacés lo demás)
2. Quick wins de código: items 1-3 de la tabla (15 min total)
3. Privacy + Terms: escribir, publicar, linkear (item 4, 2h)
4. Apple Sign-In: implementar end-to-end (item 5, 3h) — *bloqueante para review*
5. Verificar Supabase Apple provider configurado
6. Hacer `eas build --platform ios --profile production`
7. Subir con `eas submit` a App Store Connect
8. **Para TestFlight Internal**: invitar testers vía email — listo en horas
9. **Para review pública**: llenar App Store Connect (sección 3.2), submit for review, esperar 1-3 días

---

## 7. Notas finales sobre rechazos

Apple suele rechazar dos veces antes de aprobar. Lo más común:

- **"Demo account doesn't work"** → la cuenta demo no muestra contenido / está caducada. Mantenela viva y con datos.
- **"Missing functionality"** → revisaron pero no entendieron cómo funciona algo. Solución: notas más detalladas en App Review Information con paso a paso.
- **"Privacy concerns"** → el privacy policy no menciona algo que la app usa. Asegurate de cubrir TODOS los datos que recolecta Supabase Auth y profiles.
- **"4.8 - third-party login"** → ESTE es el que vamos a chocar si no implementamos Apple Sign-In. Es 100% predecible.

Cualquier rechazo te dejan responder dentro de App Store Connect. Generalmente 1 round trip arregla el problema. No te frustres; es normal.
