# ClickaClick — Contexto completo para Claude

Copia y pega todo esto como primer mensaje cuando empieces una sesión con Claude.

---

## ¿Qué es esta app?

**ClickaClick** es una app móvil de seguimiento de lectura, construida como SPA en React. El usuario puede buscar libros, registrar sesiones de lectura (con temporizador), ver estadísticas, logros, un perfil con personaje 3D, conectarse con amigos, y gestionar una biblioteca virtual física con fotos de spines reales. Tiene también una página especial para Apple Watch y un resumen anual estilo Spotify Wrapped.

**URL en producción:** desplegada en Vercel desde la rama `main` del repo GitHub `MatiasAlarconC/ClickaClick-Read`. Auto-deploy en cada push.

**Usuario principal:** mmatiasac18@gmail.com (Spanish-speaking, iOS PWA user, monochromatic UI preference)

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Routing | React Router v7 |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Deploy | Vercel (SPA con catch-all rewrite) |
| Animaciones | Framer Motion |
| 3D | Three.js + @react-three/fiber + @react-three/drei |
| Gráficos | Recharts |
| IA | Google Gemini API (via Vercel serverless functions) |
| Estilos | CSS-in-JS inline (sin CSS modules, sin Tailwind en runtime) |
| ePub Parsing | jszip |

---

## Estructura de archivos

```
/
├── api/
│   ├── books.ts          # Serverless: proxy Google Books API (key no expuesta en cliente)
│   ├── music.ts          # Serverless: busca música de fondo via Jamendo
│   └── watch.ts          # Serverless: sirve HTML standalone para Apple Watch
├── public/               # Assets estáticos
├── src/
│   ├── App.tsx           # Todas las rutas React Router
│   ├── main.tsx          # Entry point
│   ├── context/
│   │   └── AppContext.tsx # Auth, tema, perfil, notificaciones
│   ├── components/
│   │   ├── UI.tsx                  # Spinner, BookCover, TabBar, ProgressBar, Stars, etc.
│   │   ├── Icons.tsx               # Iconos SVG inline
│   │   ├── AvatarCharacter.tsx     # Personajes built-in (lion/mage/fox/owl/knight/cosmic/phoenix/shadow)
│   │   ├── AvatarCreator.tsx       # Selector de personaje y colores, progress bars de unlock
│   │   ├── Character3D.tsx         # Render 3D del personaje con Three.js
│   │   ├── Medal3D.tsx             # Render 3D de medallas
│   │   ├── MedalIcon.tsx           # Icono 2D de medalla
│   │   ├── Book3D.tsx              # Render 3D de un libro (DataTexture + InstancedMesh)
│   │   ├── ISBNScanner.tsx         # Escáner de código de barras ISBN (Search)
│   │   ├── SpineCaptureCamera.tsx  # Cámara con detección de spine (Sobel edge + EMA smoothing)
│   │   └── VirtualShelf.tsx        # Estantería virtual modular con libros arrastrables
│   ├── pages/
│   │   ├── Auth.tsx             # SplashScreen, SignUpScreen, SignInScreen
│   │   ├── Home.tsx             # Pantalla principal + sheet de notificaciones
│   │   ├── Search.tsx           # Búsqueda de libros (Google Books + OpenLibrary + ISBN scanner)
│   │   ├── BookDetail.tsx       # Detalle de libro: overview/details/notes/sessions + spine photo
│   │   ├── Session.tsx          # Temporizador de lectura + notas rápidas
│   │   ├── Library.tsx          # Librería: reading/finished/want_to_read/dropped/summaries/discover/shelf
│   │   ├── Stats.tsx            # Estadísticas con heatmap + iOS safe area
│   │   ├── Profile.tsx          # Perfil + avatar + logros + metas
│   │   ├── PublicProfile.tsx    # Perfil público de otro usuario (/profile/:userId)
│   │   ├── Friends.tsx          # Amigos: buscar, enviar/aceptar solicitudes
│   │   ├── Achievements.tsx     # Logros con medallas 3D + personajes locked
│   │   ├── AIRecommendations.tsx# Recomendaciones con Gemini
│   │   ├── YearInReview.tsx     # Resumen anual estilo Wrapped
│   │   ├── Watch.tsx            # Ruta /watch (ver api/watch.ts)
│   │   └── admin/AdminPanel.tsx # Panel de administración
│   ├── data/
│   │   └── achievements.ts      # Definición de logros y getUnlockedCharacters
│   ├── services/
│   │   ├── books.ts             # Búsqueda Google Books + OpenLibrary
│   │   └── gemini.ts            # Cliente Gemini AI (summarizeNotes, detectBookSeries, getRecommendations)
│   ├── lib/
│   │   ├── supabase.ts          # Cliente Supabase
│   │   └── theme.ts             # Temas claro y oscuro
│   └── types/
│       └── index.ts             # Todos los tipos TypeScript
├── supabase/migrations/         # SQL (se corren manualmente en Supabase SQL Editor)
├── vercel.json                  # Rewrites SPA + /watch → /api/watch
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
| `/watch` | → api/watch.ts (HTML vanilla) | No |

---

## Base de datos Supabase — Schema completo actualizado

### `profiles`
```sql
id                            UUID (FK auth.users, PK)
username                      TEXT
avatar_url                    TEXT
avatar_config                 JSONB  -- { character, primaryColor, secondaryColor, useTexture? }
title                         TEXT   -- título ganado por logros
is_admin                      BOOLEAN DEFAULT false
reading_goal_books_per_year   INTEGER DEFAULT 12
reading_goal_minutes_per_day  INTEGER DEFAULT 30
reading_goal_pages_per_day    INTEGER
reading_goal_streak_days      INTEGER
dark_mode                     BOOLEAN
created_at, updated_at        TIMESTAMPTZ
```

### `books`
```sql
id                  UUID (PK, auto-gen)
google_books_id     TEXT UNIQUE
open_library_id     TEXT
title               TEXT NOT NULL
author              TEXT
synopsis            TEXT
cover_url           TEXT
pages_default       INTEGER   -- ⚠️ NO confundir con "pages" — fue renombrado en migration 002
genres              TEXT[]
published_year      INTEGER
available_languages TEXT[]
isbn                TEXT
series_data         JSONB     -- { seriesName, position, totalBooks, nextTitle, nextAuthor, prevTitle }
```

### `user_books`
```sql
id                    UUID (PK)
user_id               UUID (FK auth.users)
book_id               UUID (FK books)
status                TEXT CHECK IN ('reading','finished','want_to_read')
current_page          INTEGER
custom_pages          INTEGER
custom_language       TEXT
user_rating           INTEGER (1-5)
started_at            TIMESTAMPTZ
finished_at           TIMESTAMPTZ
added_at              TIMESTAMPTZ
epub_storage_path     TEXT
epub_page_ratio       FLOAT
progress_pct          FLOAT
note_summary          TEXT      -- resumen generado por AI de las notas del libro
note_summary_range    JSONB     -- { from: number|null, to: number|null }
spine_url             TEXT      -- URL pública de la foto del spine (bucket: book-spines)
shelf_pos             JSONB     -- { shelf: number, left: number, rot: number, scale: number }
```
⚠️ `spine_url` y `shelf_pos` fueron agregados en `supabase/migrations/016_virtual_shelf.sql`.

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
is_manual        BOOLEAN DEFAULT false
note             TEXT
session_type     TEXT DEFAULT 'physical'
epub_cfi_start   TEXT
epub_cfi_end     TEXT
last_sentence    TEXT
chapter_name     TEXT
```

### `book_notes`
```sql
id           UUID (PK)
user_id      UUID (FK auth.users)
book_id      UUID (FK books)
page_number  INTEGER
content      TEXT
created_at   TIMESTAMPTZ
```

### `friendships`
```sql
id           UUID (PK)
requester_id UUID
addressee_id UUID
status       TEXT ('pending'|'accepted'|'declined')
UNIQUE (requester_id, addressee_id)
```

### `notifications`
```sql
id         UUID (PK)
user_id    UUID
type       TEXT ('friend_request'|'friend_accepted'|'achievement'|'challenge')
title      TEXT
body       TEXT
read       BOOLEAN DEFAULT false
data       JSONB
created_at TIMESTAMPTZ
```

### `characters_config`
```sql
id               TEXT (PK)    -- e.g. 'lion', 'mage', 'custom_dragon'
name             TEXT
description      TEXT
default_primary  TEXT
default_secondary TEXT
glb_url          TEXT         -- URL al modelo 3D GLB
enabled          BOOLEAN
rarity           TEXT
zoom_scale       FLOAT
offset_x, offset_y FLOAT
texture_url      TEXT
texture_roughness_url TEXT
snapshot_url     TEXT         -- imagen estática del personaje (para admin)
```

### `achievements_config`
```sql
id           TEXT (PK)
name         TEXT
description  TEXT
tier         TEXT ('bronze'|'silver'|'gold'|'platinum'|'diamond'|'obsidian')
reward_type  TEXT ('badge'|'title'|'character')
reward_value TEXT
condition    JSONB
sort_order   INTEGER
enabled      BOOLEAN
```

### `user_recs_cache`
```sql
user_id      UUID (PK, FK auth.users)
recs         JSONB  -- array de recomendaciones Gemini
generated_at TIMESTAMPTZ
```

---

## Supabase Storage — Buckets

| Bucket | Acceso | Uso |
|--------|--------|-----|
| `avatars` | Public | Fotos de perfil de usuario |
| `character-models` | Public | Modelos 3D GLB de personajes custom |
| `epubs` | Privado (RLS) | Archivos ePub del usuario |
| `book-spines` | Public | Fotos del spine de libros (path: `{userId}/{userBookId}.jpg`) |

---

## Tipos TypeScript importantes (`src/types/index.ts`)

```typescript
interface UserBook {
  id: string
  user_id: string
  book_id: string
  status: ReadingStatus  // 'reading' | 'finished' | 'want_to_read' | 'dropped'
  custom_pages: number | null
  current_page: number | null
  user_rating: number | null
  started_at: string | null
  finished_at: string | null
  added_at: string
  epub_storage_path: string | null
  epub_page_ratio: number | null
  progress_pct: number | null
  spine_url?: string | null      // ⚠️ NUEVO — foto del spine real del libro
  shelf_pos?: { shelf: number; left: number; rot: number; scale: number } | null  // ⚠️ NUEVO
  book?: Book
}

interface Book {
  id: string
  google_books_id: string | null
  title: string
  author: string
  cover_url: string | null
  synopsis: string | null
  pages_default: number | null  // ⚠️ NO "pages"
  genres: string[] | null
  published_year: number | null
  isbn: string | null
}

interface Theme {
  bg, bgSecondary, bgElevated, fg, fgDim, muted, border, accent, accentFg, blobFill, cardBg: string
  dark: boolean
}
```

---

## Convenciones de código — CRÍTICO

- **Estilos:** 100% inline `style={{ }}`. NUNCA clases CSS externas. Solo `<style>` tags para `env()` CSS functions.
- **No Tailwind en runtime.**
- **Monochromatic:** Solo negro/blanco/grises + tonos sepia cálidos. SIN purple (#7C3AED, #a78bfa), SIN acentos de color. Único color permitido es `theme.accent` (que en modo monocromático es oscuro).
- **Fonts:** `Georgia, serif` para títulos decorativos. `-apple-system, system-ui` para UI.
- **Framer Motion** para animaciones de página y cards.
- **Supabase joins:** `.select('book:books(title,author,pages_default)')` — siempre `pages_default` no `pages`.
- **Casts `as any`** son normales en queries Supabase — no agregar types innecesarios.
- **iOS PWA:** `paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)'` en todas las páginas.
- **Sin comentarios** excepto para lógica no obvia.

---

## AppContext (`src/context/AppContext.tsx`)

- `useAuth()` → `{ user, profile, loading, signOut, updateProfile, fetchProfile }`
- `useTheme()` → `{ theme, toggleTheme }`
- `useIsDesktop()` → boolean
- `useNotifications()` → via `useAuth` como `notifications` + `markNotificationsRead()`

⚠️ **NUNCA llamar `refreshSession()` en init** — causa 429 en Apple Watch. `getSession()` maneja refresh internamente en Supabase v2.

---

## Feature: Virtual Shelf (Estantería virtual modular)

**Componente:** `src/components/VirtualShelf.tsx`
**Acceso:** Library → tab "Shelf"

### Diseño
- Estantería física modular con tableros de madera (tonos warm: `#4a3725` top, `#33261a` face, `#221a11` edge)
- Fondo: `repeating-linear-gradient(90deg,#161616 0 3px,#181818 3px 6px)` (dark)
- Cada fila: `ROW_H=178px`, tablero: `BOARD_H=12px`, espacio útil: `DECK_H=166px`
- Máximo 6 filas (`ROWS_MAX=6`), defecto 3 (`ROWS_DEFAULT=3`)
- Filas persisten en `localStorage` con key `cc_shelf_rows_{userId}`

### Spines de libros (sin foto)
- Tamaños determinísticos (hash del `userBookId`): 6 tallas de `{w:31-47, h:110-152}px`
- Tonos monochrome determinísticos: `['#1b1b1b','#2e2e2e','#444444','#5a5a5a','#7c7c7c','#e7e3db']`
- Título en `writing-mode: vertical-rl`, Georgia serif
- `transformOrigin: 'bottom center'` — ancla en la base del tablero

### Spines con foto
- Muestra `spine_url` como `<img>` con `objectFit: 'cover'`
- Highlights de borde: `rgba(255,255,255,0.16)` izquierda, `rgba(0,0,0,0.35)` derecha

### Gestos (window-level listeners)
- **Drag:** mueve entre filas y horizontalmente
- **Rotate handle (top):** rota ±30°
- **Scale handle (bottom-right):** escala 0.7–1.6×
- **Camera handle (bottom-left):** abre SpineCaptureCamera para ese libro
- **Remove handle (top-right):** saca del shelf (shelf_pos → null)
- Handles contra-escalados: `invScale = 1/book.pos.scale`

### Estado persistido en DB
```javascript
shelf_pos: { shelf: number, left: number, rot: number, scale: number }
spine_url: string  // URL pública en Supabase Storage
```

### Flujo "Add from Library"
1. Botón "+ Library" o FAB cámara (sin libro seleccionado) llama `openLibSheet()`
2. `openLibSheet()` fetchea `user_books` WHERE `shelf_pos IS NULL` para el usuario
3. Muestra hoja modal con libros; cada uno tiene botón "solo agregar" y botón "agregar + capturar spine"
4. `addBook()` guarda `shelf_pos` en DB y agrega al estado local

---

## Feature: SpineCaptureCamera

**Componente:** `src/components/SpineCaptureCamera.tsx`

### Algoritmo de detección
- Canvas de análisis: `AW=160 × AH=240` a ~12fps
- **Sobel X:** detecta bordes verticales → columnas izquierda/derecha del spine
- **Sobel Y:** detecta bordes horizontales → filas top/bottom del spine (solo dentro del rango de columnas detectado)
- **EMA smoothing:** `alpha=0.12`, `CONFIDENCE_THRESH=6` frames para estabilización
- Fallback: `top=0.04, bottom=0.96` cuando confianza es baja

### UI
- Overlay full-screen negro con recorte transparente del área detectada
- Líneas de guía siempre blancas (`rgba(255,255,255,0.88)`)
- Acentos de esquina blancos
- "Capture Spine" button cuando confianza es alta
- Modo ajuste manual: sliders left/right

### Props
```typescript
interface Props {
  bookTitle: string
  onCapture: (dataUrl: string) => void  // JPEG data URL del spine recortado
  onClose: () => void
}
```

---

## Feature: Spine Photo en BookDetail

**Ubicación:** `src/pages/BookDetail.tsx` → tab "Details"

- Si el libro está en la librería del usuario (`userBook` existe): muestra sección "Book Spine"
- Con foto: thumbnail 54×160px + botón "Retake photo"
- Sin foto: botón dashed "Capture spine photo"
- Al capturar: upload a `book-spines/{userId}/{userBookId}.jpg` (upsert), update `user_books.spine_url`, update estado local

---

## Feature: Spine Capture desde Library (book rows)

**Ubicación:** `src/pages/Library.tsx`

- Cada fila de libro en "Finished" tab tiene un ícono de cámara pequeño
- Toca cámara → `setSpineTarget({ userBookId, title })` → `SpineCaptureCamera` abre
- `Library.handleSpineCaptured`: sube foto y actualiza `user_books.spine_url`
- **Flujo requerido:** El libro YA debe estar en la librería para agregar foto de spine

---

## Feature: Discover Tab (For You)

**Ubicación:** `src/pages/Library.tsx` → tab "✦ For You"

- Recomendaciones generadas por Gemini basadas en libros leídos
- Caché de 24h en `localStorage` + `user_recs_cache` en Supabase (cross-device)
- Botón "↺ Refresh" para forzar regeneración
- "Load more" para páginas adicionales de recomendaciones

---

## Feature: Book3D

**Componente:** `src/components/Book3D.tsx`

- DataTexture para texturas confiables (no CanvasTexture que se rompía en mobile Safari)
- InstancedMesh con 22 strips para simular páginas en el lomo
- Lighting: Directional cálida (top-right) + fill azul (izquierda) + rim light
- Proxy de cover images via `/api/books` para resolver CORS

---

## Feature: Apple Watch

- React SPA no funciona en watchOS WebKit → `api/watch.ts` retorna HTML puro con JS vanilla
- `vercel.json` redirige `/watch → /api/watch` antes del catch-all
- Inyecta `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- Flow: Sign In → Picker de libro en curso → Temporizador → Fin → Guarda sesión

---

## Lógica de páginas leídas (Stats y Profile)

```typescript
// Gap fill para libros terminados este año sin sesiones que cubran todas las páginas
const sessionPagesByBook: Record<string, number> = {}
for (const s of sessions) {
  sessionPagesByBook[s.book_id] = (sessionPagesByBook[s.book_id] ?? 0) + (s.pages_read ?? 0)
}
let pagesRead = sessions.reduce((s, r) => s + (r.pages_read ?? 0), 0)
for (const b of userBooks) {
  if (b.status !== 'finished') continue
  const finishedAt = b.finished_at ? new Date(b.finished_at) : null
  if (finishedAt && finishedAt < yearStart) continue
  const bookPages = b.custom_pages ?? b.book?.pages_default ?? 0
  const tracked = sessionPagesByBook[b.book_id] ?? 0
  if (bookPages > tracked) pagesRead += (bookPages - tracked)
}
```

---

## Personajes disponibles

**CharacterId:** `'lion' | 'mage' | 'fox' | 'owl' | 'knight' | 'cosmic' | 'phoenix' | 'shadow'`

| Personaje | Estado | Desbloqueo |
|-----------|--------|-----------|
| lion | Siempre disponible | — |
| knight | Por logro | Streak de 7 días |
| owl | Por logro | 15 sesiones de lectura |
| fox | Por logro | 30 libros terminados |
| mage | Por logro | Achievements.ts |
| cosmic | Por logro | 5 libros sci-fi |
| phoenix | Por logro | Alto logro |
| shadow | Por logro | Alto logro |

**Propuestos (no confirmados):** dragon, cat, robot, wolf, bear, samurai, crystal, fairy, witch, elf, navigator, ghost

---

## Variables de entorno

```
VITE_SUPABASE_URL=         # URL del proyecto Supabase
VITE_SUPABASE_ANON_KEY=    # Anon key pública
VITE_GEMINI_API_KEY=       # Google Gemini API key
```

---

## Migraciones — estado actual

Todas las migraciones están en `supabase/migrations/`. Se corren **manualmente** en el SQL Editor de Supabase.

| Archivo | Contenido | Estado |
|---------|-----------|--------|
| 001–010 | Schema base | ✅ Corrido |
| 011_notifications.sql | Tabla notifications | ✅ Corrido |
| 012–015 | Features varios | ✅ Corrido |
| 016_virtual_shelf.sql | Columnas `spine_url`, `shelf_pos` en `user_books`; bucket `book-spines` con políticas RLS | ✅ Corrido |

---

## Reglas de Claude para este proyecto

1. **Inline styles SIEMPRE** — nunca CSS classes, nunca Tailwind en runtime
2. **Monochromatic** — solo black/white/gray + theme tokens. Sin purple ni acentos de color
3. **No romper features existentes** — leer archivos antes de sugerir cambios
4. **`pages_default`** en todos los joins con `books` — nunca `pages`
5. **No llamar `refreshSession()`** en init ni visibility change
6. **epubjs:** CSS solo en iframe `document.head`, no en DOM padre
7. **Spine capture flow:** solo si el libro ya está en la librería del usuario
8. **Guardar contexto en memory** después de cada sesión de cambios

---

## Cambios recientes (desde 2026-06-13)

### 2026-06-13 a 2026-06-18 (sesión anterior)
- Stats heatmap month gaps (5px entre meses)
- iOS safe area en todas las páginas
- Library card borders/radius
- Book3D DataTexture + InstancedMesh + lighting mejorado
- Search results label actualizado
- BookDetail: Notes/Sessions tabs solo si libro está en librería
- Summaries cross-device sync via Supabase
- Series context para AI summaries
- Character achievement progress bars
- Character 3D models para locked characters

### 2026-06-23 a 2026-06-25 (sesión actual)
- **VirtualShelf.tsx** — estantería modular completa con gestos drag/rotate/scale, tableros de madera, spines monochrome determinísticos, persistencia en DB
- **SpineCaptureCamera.tsx** — cámara con Sobel X+Y, EMA smoothing (alpha=0.12), líneas blancas, 4 bordes de recorte
- **Library.tsx** — tab "Shelf" + tab "✦ For You" (discover/recomendaciones Gemini), ícono de cámara en filas de libros terminados, `SpineCaptureCamera` a nivel de Library
- **BookDetail.tsx** — sección "Book Spine" en tab Details: muestra foto o botón de captura; `SpineCaptureCamera` integrado
- **Migration 016** — `spine_url TEXT`, `shelf_pos JSONB` en `user_books`; bucket `book-spines` público con RLS
- **types/index.ts** — `spine_url?` y `shelf_pos?` en `UserBook`
- **Fix openLibSheet** — botones llamaban `setShowLibSheet(true)` en lugar de `openLibSheet()`, lo que impedía que se fetchearan los libros de la librería

---

Fin del contexto. Última actualización: 2026-06-25.
