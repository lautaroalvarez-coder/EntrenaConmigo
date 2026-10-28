# Entrená conmigo

Plataforma de entrenamiento: el profe arma rutinas (microciclos → sesiones → bloques → ejercicios) y cada alumno carga sus series, ve su registro y envía feedback. **Todo queda guardado en una base de datos Postgres.**

```
public/index.html      página
public/css/styles.css  estilos
public/js/app.js       lógica del front
api/[...path].js       API (funciones de Vercel + Postgres de Neon)
```

## Cómo funciona

- **Profe:** entra a la web, abre "Soy el profe" y pone su contraseña. Crea alumnos y edita rutinas con el botón *Modo profe*.
- **Alumno:** el profe le pasa su link personal (`/?a=XXXX`, botón *Copiar link*). Sin cuenta ni contraseña; el link es la llave, así que no lo compartas. El celular lo recuerda.
- Las tablas (`alumnos`, `registros`, `feedback`) se crean solas la primera vez.

## Publicarlo en Vercel

1. Subí esta carpeta a un repo de GitHub e importalo en vercel.com (o corré `npx vercel`).
2. En el proyecto: **Storage → Create → Neon (Postgres)** y conectalo. Vercel agrega `DATABASE_URL` solo.
3. En **Settings → Environment Variables** agregá:
   - `COACH_PASSWORD`: tu contraseña de profe
   - `AUTH_SECRET`: un texto largo y aleatorio
4. Redeploy. Listo.

## Probar en tu compu

```bash
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev
```
