# ClickaClick — Contexto completo para Claude

Copia y pega todo esto como primer mensaje cuando empieces una sesión con Claude.

---

## ¿Qué es esta app?

**ClickaClick** es una app móvil de seguimiento de lectura, construida como SPA en React. El usuario puede buscar libros, registrar sesiones de lectura (con temporizador), ver estadísticas, logros, un perfil con personaje 3D, y conectarse con amigos. Tiene también una página especial para Apple Watch y un resumen anual estilo Spotify Wrapped.

**URL en producción:** desplegada en Vercel desde la rama `main` del repo GitHub `MatiasAlarconC/ClickaClick-Read`. Auto-deploy en cada push.

**Usuario principal:** mmatiasac18@gmail.com (Spanish-speaking, iOS PWA user, prefers monochromatic UI)

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Routing | React Router v7 |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Deploy | Vercel (SPA con catch-all rewrite) |
| Animaciones | Framer Motion |
| 3D | Three.js + @react-three/fiber + @react-three/drei |
| Gráficos | Recharts |
| IA | Google Gemini API (via Vercel serverless functions) |
| Estilos | CSS-in-JS inline (sin CSS modules, sin Tailwind en runtime) |
| ePub Parsing | jszip (for future ePub summary feature) |

---

## Estructura de archivos

```
/
├── api/
│   ├── books.ts          # Serverless: proxy Google Books API (key not exposed in client)
│   ├── music.ts          # Serverless: busca música de fondo via Spotify
│   └── watch.ts          # Serverless: sirve la página HTML standalone para Apple Watch
├── public/               # Assets estáticos (favicon, etc.)
├── src/
│   ├── App.tsx           # Todas las rutas React Router
│   ├── main.tsx          # Entry point
│   ├── context/
│   │   └── AppContext.tsx # Auth, tema, perfil, notificaciones (useAuth, useTheme, useIsDesktop)
│   ├── components/
│   │   ├── UI.tsx         # Spinner, BookCover, TabBar, etc.
│   │   ├── Icons.tsx      # Iconos SVG inline
│   │   ├── AvatarCharacter.tsx  # Definición de personajes built-in (lion, mage, fox, owl, knight, cosmic, phoenix, shadow)
│   │   ├── AvatarCreator.tsx    # Selector de personaje y colores con progress bars para unlock
│   │   ├── Character3D.tsx      # Render 3D del personaje con Three.js (locked={true} para greyscale)
│   │   ├── Medal3D.tsx          # Render 3D de medallas de logros
│   │   ├── MedalIcon.tsx        # Icono 2D de medalla
│   │   └── Book3D.tsx           # Render 3D de un libro (DataTexture + InstancedMesh page strips)
│   ├── pages/
│   │   ├── Auth.tsx             # SplashScreen, SignUpScreen, SignInScreen
│   │   ├── Home.tsx             # Pantalla principal + sheet de notificaciones (iOS safe area)
│   │   ├── Search.tsx           # Búsqueda de libros (Google Books + OpenLibrary), results label updated
│   │   ├── BookDetail.tsx       # Detalle de libro + agregar a librería (Notes/Sessions conditional)
│   │   ├── Session.tsx          # Temporizador de lectura + notas rápidas
│   │   ├── Library.tsx          # Librería del usuario (leyendo / terminados / quiero leer / summaries tab)
│   │   ├── Stats.tsx            # Estadísticas con heatmap (month separation gaps) + iOS safe area
│   │   ├── Profile.tsx          # Perfil propio + editor de avatar + logros + metas (iOS safe area)
│   │   ├── PublicProfile.tsx    # Perfil público de otro usuario (/profile/:userId)
│   │   ├── Friends.tsx          # Amigos: buscar, enviar/aceptar solicitudes, ver lista
│   │   ├── Achievements.tsx     # Pantalla de logros con medallas 3D + character models (locked={true})
│   │   ├── AIRecommendations.tsx # Recomendaciones de libros con Gemini
│   │   ├── YearInReview.tsx     # Resumen anual estilo Wrapped
│   │   ├── Watch.tsx            # Ruta /watch en React (no funciona en watchOS, ver api/watch.ts)
│   │   └── admin/AdminPanel.tsx # Panel de administración
│   ├── data/
│   │   └── achievements.ts      # Definición de todos los logros y función getUnlockedCharacters
│   ├── services/
│   │   ├── books.ts             # Búsqueda en Google Books y OpenLibrary (con proxy /api/books)
│   │   └── gemini.ts            # Cliente para llamadas a Gemini AI (summarizeNotes + previousBookSummary)
│   ├── lib/
│   │   ├── supabase.ts          # Cliente Supabase (usa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY)
│   │   └── theme.ts             # Objeto de tema claro y oscuro
│   └── types/
│       └── index.ts             # Todos los tipos TypeScript
├── supabase/migrations/         # Migraciones SQL (se corren manualmente en Supabase SQL Editor)
├── vercel.json                  # Rewrites: /watch → /api/watch, /api/books → /api/books, todo lo demás → /index.html
└── .env.local                   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GEMINI_API_KEY
```

---

## Rutas React Router

| Path | Componente | Requiere auth |
|------|-----------|---------------|
| `/` | SplashScreen | No |
| `/signup` | SignUpScreen | No |
| `/signin` | SignInScreen | No |
| `/home` | HomeScreen | Sí |
| `/search` | SearchScreen | Sí |
| `/detail` | BookDetailScreen | Sí |
| `/session` | SessionScreen | Sí |
| `/library` | LibraryScreen | Sí |
| `/stats` | StatsScreen | Sí |
| `/profile` | ProfileScreen | Sí |
| `/profile/:userId` | PublicProfileScreen | Sí |
| `/friends` | FriendsScreen | Sí |
| `/achievements` | AchievementsScreen | Sí |
| `/ai` | AIRecommendationsScreen | Sí |
| `/yearreview` | YearInReviewScreen | Sí |
| `/admin` | AdminPanel | Sí + is_admin |
| `/watch` | → api/watch.ts (HTML standalone) | No (vanilla JS) |

---

## Base de datos Supabase — Schema completo

### `profiles`
```sql
id                            UUID (FK auth.users, PK)
username                      TEXT
avatar_url                    TEXT
avatar_config                 JSONB  -- { character, primaryColor, secondaryColor }
title                         TEXT   -- título ganado por logros
is_admin                      BOOLEAN DEFAULT false
reading_goal_books_per_year   INTEGER DEFAULT 12
reading_goal_minutes_per_day  INTEGER DEFAULT 30
reading_goal_pages_per_day    INTEGER
reading_goal_streak_days      INTEGER
dark_mode                     BOOLEAN
created_at, updated_at        TIMESTAMPTZ
```
**RLS:** usuarios ven/editan su propio perfil. Todos pueden buscar perfiles (para amigos).

### `books`
```sql
id                  UUID (PK)
google_books_id     TEXT UNIQUE
open_library_id     TEXT
title               TEXT NOT NULL
author              TEXT
synopsis            TEXT
cover_url           TEXT
pages_default       INTEGER   -- ⚠️ se llamaba page_count en migration 001, renombrado en 002
genres              TEXT[]
published_year      INTEGER
available_languages TEXT[]
isbn                TEXT
series_data         JSONB     -- { title, position, count } para detectar sagas
```
**RLS:** cualquiera puede leer, autenticados pueden insertar y actualizar.

### `user_books`
```sql
id                    UUID (PK)
user_id               UUID (FK auth.users)
book_id               UUID (FK books)
status                TEXT CHECK IN ('reading','finished','want_to_read')
current_page          INTEGER
custom_pages          INTEGER   -- override de pages_default del libro
custom_language       TEXT
user_rating           INTEGER (1-5)
started_at            TIMESTAMPTZ
finished_at           TIMESTAMPTZ
added_at              TIMESTAMPTZ
note_summary          TEXT      -- ⚠️ NUEVO: resumen del libro (from notes o from ePub)
note_summary_range    JSONB     -- ⚠️ NUEVO: { start_page, end_page } del resumen
```
**RLS:** usuarios manejan sus propios registros. Cualquier usuario autenticado puede ver el shelf de otro (para perfiles públicos).

### `reading_sessions`
```sql
id               UUID (PK)
user_id          UUID (FK auth.users)
book_id          UUID (FK books)
started_at       TIMESTAMPTZ NOT NULL
ended_at         TIMESTAMPTZ
duration_seconds INTEGER
start_page       INTEGER
end_page         INTEGER
pages_read       INTEGER
is_manual        BOOLEAN DEFAULT false  -- true = entrada manual de página (no sesión real)
note             TEXT
```
**RLS:** usuarios manejan sus propias sesiones. Cualquier autenticado puede ver las de otros (para stats de perfil público).

### `book_notes`
```sql
id           UUID (PK)
user_id      UUID (FK auth.users)
book_id      UUID (FK books)
page_number  INTEGER
content      TEXT
created_at   TIMESTAMPTZ
```
**RLS:** solo el dueño.

### `friendships`
```sql
id           UUID (PK)
requester_id UUID (FK auth.users)
addressee_id UUID (FK auth.users)
status       TEXT CHECK IN ('pending','accepted','declined')
created_at   TIMESTAMPTZ
UNIQUE (requester_id, addressee_id)
```
**RLS:** ambas partes ven sus friendships. Solo el requester puede crear. Solo el addressee puede aceptar/rechazar. Cualquiera puede eliminar.

### `notifications`
```sql
id         UUID (PK)
user_id    UUID (FK auth.users)
type       TEXT  -- 'friend_request' | 'friend_accepted' | 'achievement' | 'challenge'
title      TEXT
body       TEXT
read       BOOLEAN DEFAULT false
data       JSONB  -- { from_user_id, achievement_id, etc. }
created_at TIMESTAMPTZ
```
**RLS:** solo el dueño. ⚠️ Esta tabla requiere correr `supabase/migrations/011_notifications.sql` en el SQL Editor de Supabase.

### `ai_usage_logs`
Registra tokens usados por funciones de Gemini.

### `admin_config`
Flags para habilitar/deshabilitar features de Gemini (`gemini_enabled`, `gemini_model`, `monthly_token_budget`, etc.).

### `ai_summary_cache`
Caché de resúmenes generados por Gemini para no repetir llamadas.

### `characters_config`
```sql
id            UUID (PK)
name          TEXT UNIQUE  -- nombre del personaje (custom o built-in)
model_url     TEXT         -- URL al modelo 3D (GLB)
description   TEXT
is_builtin    BOOLEAN DEFAULT false
created_at    TIMESTAMPTZ
```
**Propósito:** Almacenar modelos 3D custom de personajes desde admin panel.

### `achievements_config`
```sql
id              UUID (PK)
name            TEXT
description     TEXT
condition       JSONB  -- { type, target, property } para cálculo de progreso
reward_type     TEXT   -- 'character' | 'title' | 'medal'
reward_value    TEXT   -- nombre del personaje, título, o tipo de medalla
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ
```
**Propósito:** Asociar logros con personajes desbloqueables (achievement unlock progress).

---

## Contexto del AppContext (`src/context/AppContext.tsx`)

Exporta:
- `useAuth()` → `{ user, profile, loading, signOut, updateProfile, fetchProfile }`
- `useTheme()` → `{ theme, toggleTheme }` (tema claro/oscuro basado en `profile.dark_mode`)
- `useIsDesktop()` → boolean (basado en `window.matchMedia('(min-width: 768px)')`)
- `useNotifications()` → disponible via useAuth como `notifications` y `markNotificationsRead()`

El `AppContext` también tiene:
- `notifications: AppNotification[]` — cargadas en fetchProfile para mostrar el sheet en Home
- `markNotificationsRead()` — marca todas como `read = true` en Supabase

---

## Tipos TypeScript importantes (`src/types/index.ts`)

```typescript
interface Book {
  pages_default: number | null  // columna real en DB, NO "pages"
  series_data?: { title: string; position: number; count: number }
  // ... resto de campos
}

interface UserBook {
  custom_pages: number | null  // override del usuario sobre pages_default
  current_page: number | null
  finished_at: string | null
  note_summary?: string | null  // NUEVO: resumen generado
  note_summary_range?: { start_page: number; end_page: number }  // NUEVO
  // ...
}

interface ReadingSession {
  is_manual?: boolean
  pages_read: number | null
  book_id: string
  // ...
}

interface DBAchievement {
  id: string
  name: string
  description: string
  condition: { type: string; target: number; property: string }
  reward_type: 'character' | 'title' | 'medal'
  reward_value: string
  is_active: boolean
}

interface AchievementStats {
  books_read: number
  pages_read: number
  sessions_completed: number
  reading_streak_days: number
  friends_added: number
  // ... más propiedades de progreso
}
```

---

## Lógica de cálculo de páginas (Stats y Profile)

Hay una lógica especial para calcular `pagesRead` que existe tanto en `Stats.tsx` como en `Profile.tsx`:

```typescript
// 1. Suma páginas de sesiones del año
const sessionPagesByBook: Record<string, number> = {}
for (const s of sessions) {
  if (s.book_id) sessionPagesByBook[s.book_id] = (sessionPagesByBook[s.book_id] ?? 0) + (s.pages_read ?? 0)
}
let pagesRead = sessions.reduce((s, r) => s + (r.pages_read ?? 0), 0)

// 2. Gap fill: para libros terminados este año, si las sesiones no cubren
//    todas las páginas del libro, se suman las páginas faltantes
const yearStart = new Date(new Date().getFullYear(), 0, 1)
for (const b of userBooks) {
  if (b.status !== 'finished') continue
  const finishedAt = b.finished_at ? new Date(b.finished_at) : null
  if (finishedAt && finishedAt < yearStart) continue
  const bookPages = b.custom_pages ?? b.book?.pages_default ?? 0
  if (!bookPages) continue
  const tracked = sessionPagesByBook[b.book_id] ?? 0
  if (bookPages > tracked) pagesRead += (bookPages - tracked)
}
```

---

## iOS Safe Area — CSS `env()` variables

**Problema:** En iOS PWA, la notch y las barras del sistema sobrelapaban contenido.

**Solución:** Todas las páginas ahora usan:
```typescript
paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)'
paddingLeft: 'env(safe-area-inset-left, 0px)'
paddingRight: 'env(safe-area-inset-right, 0px)'
paddingBottom: 'env(safe-area-inset-bottom, 0px)'
```

**Páginas actualizadas:** Home, Search, Stats, Profile, Achievements, Library, BookDetail.

---

## Book3D — Render 3D realista del libro

**Evolución:**
- ~~CanvasTexture~~ (se rompía en mobile Safari WebGL)
- **DataTexture:** Crea texturas confiables con Uint8Array. Método `makePageLineTex()` genera una imagen 1×64 con líneas de página (alternando light/dark).
- **InstancedMesh:** Agrega 22 strips delgadas oscuras en el borde derecho del lomo (+X face) para simular separadores de página.
- **Lighting:** Directional cálida (top-right), fill azul (izquierda), y rim light para profundidad.
- **Materiales:** DataTexture para spines de páginas, MeshStandardMaterial sólido para tapa/fondo.

**Resultado:** Libros 3D realistas con profundidad perceptible en todas las plataformas.

---

## Book Summaries (Resúmenes)

**Almacenamiento:** `user_books.note_summary` y `user_books.note_summary_range` (NUEVO).

**Flujo:**
1. BookDetail.tsx carga notas cuando se abre un libro
2. Usuario puede hacer click en "Resumen" para generar uno:
   - **From Notes:** parsea notas del usuario y llama a `summarizeNotes(notes, previousBookSummary)`
   - **From ePub:** (pendiente) descarga ePub vía `/api/epub-summarize`, extrae texto, llama a Gemini
3. Resumen se guarda en `user_books.note_summary` en Supabase
4. Library.tsx Summaries tab carga desde `user_books` con fallback a localStorage

**Serie Context:** `summarizeNotes()` ahora acepta `previousBookSummary?: string`. Si el libro es parte de una saga, se inyecta el resumen del libro anterior en el prompt de Gemini.

---

## Apple Watch — `/watch`

- El React SPA no funciona en watchOS WebKit (JS moderno no soportado → pantalla blanca).
- **Solución:** `api/watch.ts` es una función serverless Vercel que retorna HTML puro con JS vanilla.
- `vercel.json` redirige `/watch` → `/api/watch` antes del catch-all.
- La función inyecta `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del entorno de Vercel.
- Flow: Sign In → Picker de libro en curso → Temporizador → Fin (ingresa página final) → Guarda sesión.
- ⚠️ NO llamar `refreshSession()` en initialización — causa múltiples refreshes.

---

## Serverless API functions (`/api/`)

### `api/books.ts`
- GET `/api/books?query=...`
- Proxy de Google Books API (key nunca expuesta en client bundle).
- Retorna lista de libros con metadata.

### `api/music.ts`
- GET `/api/music?query=...`
- Busca pistas de música ambiental en Spotify o similar para la sesión de lectura.

### `api/watch.ts`
- GET `/watch`
- Retorna HTML standalone para Apple Watch con credenciales Supabase inyectadas.

### `api/epub-summarize.ts` (PENDIENTE)
- POST `/api/epub-summarize`
- Body: `{ epubUrl: string, previousSummary?: string }`
- Descarga ePub, extrae texto con jszip, llama a Gemini, retorna resumen.

---

## Personajes disponibles (avatares 3D)

**Built-in (8):** `'lion' | 'mage' | 'fox' | 'owl' | 'knight' | 'cosmic' | 'phoenix' | 'shadow'`

Cada uno tiene `defaultPrimary` y `defaultSecondary` (colores hex). El usuario puede personalizar colores.

**Custom (desde admin):** Personajes creados en admin panel, almacenados en tabla `characters_config` con modelos 3D (GLB).

**Desbloqueo:** Logros con `reward_type === 'character'` desbloquean personajes. AvatarCreator muestra:
- Personaje 3D normal si desbloqueado
- Personaje 3D con `locked={true}` (greyscale + 0.35 opacity) + progress bar si hay logro asociado

---

## Sistema de logros (`src/data/achievements.ts`)

- Logros con niveles (bronze, silver, gold, platinum).
- Se calculan en `Achievements.tsx` a partir de `AchievementStats`.
- Nuevos logros desbloqueados → insertan una `notification` en Supabase.
- Se guardan en `localStorage` (clave `seen_achievements_{userId}`) para no re-notificar.

**Achievement Unlock Progress (NUEVO):**
- `AvatarCreator` recibe props `dbAchievements` y `achievementStats`
- Si un personaje custom está disponible en DB achievements:
  - Busca logro con `reward_type === 'character' && reward_value === selectedCharacter`
  - Calcula progreso con `getConditionProgress(achievement.condition, achievementStats)`
  - Muestra progress bar debajo del hint de desbloqueo

---

## Convenciones de código

- **Estilos:** 100% inline (`style={{ ... }}`). No hay clases CSS salvo excepciones mínimas.
- **No Tailwind en runtime.** Tailwind está instalado pero apenas usado.
- **Framer Motion** para casi todas las animaciones (page transitions, cards, etc.).
- **Supabase queries** con `.select('campo:tabla(col1,col2)')` para joins. ⚠️ Siempre usar `pages_default` (no `pages`) al joinear con `books`.
- **Temas:** `theme.bg`, `theme.bgSecondary`, `theme.bgElevated`, `theme.fg`, `theme.fgDim`, `theme.muted`, `theme.border`, `theme.accent`, `theme.accentFg`, `theme.dark`.
- **Sin TypeScript estricto en queries Supabase** — se usan casts `as any` con frecuencia.
- **iOS PWA:** Safe area insets vía `env()` CSS variables.
- Fuente decorativa: `Georgia, serif` para títulos. UI: `-apple-system, system-ui`.

---

## Variables de entorno

```
VITE_SUPABASE_URL=         # URL del proyecto Supabase
VITE_SUPABASE_ANON_KEY=    # Anon key pública de Supabase
VITE_GEMINI_API_KEY=       # Google Gemini API key
```
En Vercel estas mismas variables están configuradas como Environment Variables del proyecto.

---

## Migrations pendientes de correr en Supabase SQL Editor

### 1. Notificaciones (si no se ha corrido)
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  type TEXT DEFAULT 'achievement',
  title TEXT,
  body TEXT,
  read BOOLEAN DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own notifications" ON notifications 
  FOR SELECT USING (auth.uid() = user_id);
```

### 2. Resúmenes de libros (NUEVO - CRÍTICO)
```sql
ALTER TABLE user_books ADD COLUMN IF NOT EXISTS note_summary TEXT;
ALTER TABLE user_books ADD COLUMN IF NOT EXISTS note_summary_range JSONB;
```

### 3. Series data en libros (ya existe, verificar)
```sql
ALTER TABLE books ADD COLUMN IF NOT EXISTS series_data JSONB;
```

### 4. Configuración de personajes custom (NUEVO - OPCIONAL)
```sql
CREATE TABLE characters_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  model_url TEXT,
  description TEXT,
  is_builtin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE characters_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read characters" ON characters_config FOR SELECT USING (true);
```

### 5. Configuración de logros (NUEVO - OPCIONAL)
```sql
CREATE TABLE achievements_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  condition JSONB,
  reward_type TEXT,
  reward_value TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE achievements_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read achievements" ON achievements_config FOR SELECT USING (true);
```

---

## Cambios recientes (sesión actual 2026-06-18)

### Fixes UI/UX completados:

1. **Stats heatmap month separation** — Agregado gap de 5px entre columnas de meses para claridad visual.
   
2. **iOS PWA safe area padding** — Todas las páginas (Home, Search, Stats, Profile, Achievements, Library, BookDetail) actualizadas con `paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)'` y insets laterales/inferior.

3. **Library book card visual collision** — Todos los tabs (reading, want_to_read, dropped) ahora envueltos en containers con borde y `borderRadius: 16`.

4. **Book3D realism enhancement** — Reemplazado CanvasTexture (roto en mobile Safari) con DataTexture confiable, agregado InstancedMesh de 22 strips para simular separadores de página, mejorado lighting (warm directional + cool fill + rim light).

5. **Search results label** — Cambiado de `"${totalItems.toLocaleString()} books found"` a `"Top ${filtered.length} results"`.

6. **BookDetail tab visibility** — Notes y Sessions tabs solo se muestran si `userBook` existe (libro ya agregado a librería).

7. **Summaries cross-device sync** — Agregado nueva columna `note_summary` en `user_books`, Library Summaries tab ahora carga desde Supabase con fallback a localStorage, BookDetail guarda a Supabase.

8. **Series context for summaries** — `summarizeNotes()` ahora acepta `previousBookSummary`, inyectado en prompt de Gemini para crear resúmenes conscientes de sagas.

9. **Character achievement progress bars** — AvatarCreator ahora muestra progress bar debajo del unlock hint si existe logro asociado en DB.

10. **Character 3D models for locked characters** — Achievements.tsx ahora render `Character3D` con `locked={true}` (greyscale + opacity) para todos los personajes (built-in y custom).

### Cambios en archivos:

- `src/pages/Stats.tsx` — heatmap gaps, iOS safe area
- `src/pages/Library.tsx` — card borders, summaries tab con Supabase query
- `src/pages/BookDetail.tsx` — tab conditionals, note_summary queries, PrevSeriesSummary component
- `src/pages/Search.tsx` — results label, iOS safe area
- `src/pages/Home.tsx`, `src/pages/Profile.tsx`, `src/pages/Achievements.tsx` — iOS safe area
- `src/components/Book3D.tsx` — DataTexture + InstancedMesh + improved lighting
- `src/components/AvatarCreator.tsx` — achievement lookup, progress bar calculation
- `src/services/gemini.ts` — previousBookSummary parameter

### Últimos commits (git log):
- `75c36e1` fix: proxy book cover images to resolve CORS error in Book3D
- `b69c3cf` feat: proxy google books through /api/books — key never exposed in client bundle
- `6b9247e` debug: log Google Books 400 response body
- `84ae524` feat: upsert book to DB on first view so series_data is shared across all users immediately
- `26e7afc` fix: series detection for books not yet in DB; feat: book3d reflective floor, contact shadows, HDR env

---

## Pending features y mejoras

- **ePub Summary Feature:** Requiere `/api/epub-summarize.ts` para descargar ePub, parsear con jszip, resumen con Gemini. BookDetail Notes tab necesita botón "From ePub" si `epubPath` existe.

- **12 New Characters:** Usuario mencionó 12 personajes adicionales para futura expansión (pendiente confirmación de diseños).

- **Music Improvement:** Mejoras en selección/caching de música de fondo (bajo priority).

- **Page Prediction:** IA para predecir página actual basada en patrón de lectura (experimental).

---

Fin del contexto. Para futuras sesiones: si Claude autocompacta, este documento ya incluye toda la información necesaria para continuar sin pérdida de contexto.
