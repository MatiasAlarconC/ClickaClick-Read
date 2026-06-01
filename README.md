# ClickaClick — Reading Tracker App

ClickaClick es una app web mobile-first para trackear tu vida lectora. La idea es simple: que leer sea tan satisfactorio de registrar como cualquier otro hábito. Podés cronometrar sesiones, ver tus stats, competir con amigos y recibir un recap anual épico.

---

## ¿Qué es?

Una app de lectura personal con foco en la experiencia. No es solo una lista de libros — tiene sesiones cronometradas con música ambient, estadísticas detalladas, logros desbloqueables, recomendaciones por IA, y un "Year in Review" estilo Spotify Wrapped al final del año.

Está pensada para usarse desde el celular pero también funciona en desktop con sidebar.

---

## Funcionalidades principales

**📚 Biblioteca personal**
Buscás libros con la API de Google Books y los agregás a tu estante con estado: *Quiero leer*, *Leyendo* o *Terminado*. Podés llevar la página actual y dar una puntuación en estrellas.

**⏱ Sesiones de lectura**
Timer en vivo para cronometrar cuánto leés. Al terminar se guardan las páginas avanzadas y los minutos. Tiene música ambient de fondo (Jamendo) que podés activar/pausar.

**📊 Estadísticas**
Gráficos de actividad diaria, semanal y mensual. Racha de días consecutivos, progreso hacia tus metas (libros por año, minutos por día, páginas por día) y un heatmap de lectura.

**🤖 Recomendaciones por IA**
Gemini analiza tu historial y géneros favoritos para sugerirte libros que probablemente te gusten.

**🏅 Logros**
Medallas desbloqueables por hitos: primer libro, rachas largas, cantidad de páginas, géneros explorados. Las medallas tienen render 3D.

**🎬 Year in Review**
Un recap anual cinematográfico con diapositivas animadas: estrellas en canvas, confetti, texto con gradiente, grain de película, música ambient y opción de guardar como imagen. Estilo Spotify Wrapped.

**👥 Amigos**
Podés seguir a otros usuarios, ver sus estantes públicos y sus stats, y ver la actividad reciente de tus amigos.

**👤 Perfil**
Avatar customizable (constructor 2D + preview 3D), nombre de usuario y título ganado según tus logros.

---

## Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend / DB / Auth**: Supabase (PostgreSQL con Row Level Security)
- **Deploy**: Vercel (auto-deploy desde `main`)
- **Animaciones**: Framer Motion
- **3D**: Three.js (`@react-three/fiber`)
- **Charts**: Recharts
- **APIs externas**: Google Books, Google Gemini, Jamendo (música)
