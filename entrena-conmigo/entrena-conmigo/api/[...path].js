import { neon } from '@neondatabase/serverless';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const sql = neon(process.env.DATABASE_URL);
const PASS = process.env.COACH_PASSWORD || '';
const SECRET = process.env.AUTH_SECRET || PASS;
const BL = ['Movilidad + rehab', 'Activación', 'Fuerza rápida · media · pliometría', 'Fuerza A', 'Fuerza B', 'Complementos / auxiliares'];
const PLAN0 = [{ n: 'Microciclo 1', ses: [{ foco: '', b: BL.map(n => ({ n, ex: [] })) }] }];

// Las tablas se crean solas la primera vez que se llama a la API.
let ready;
const init = () => ready ??= (async () => {
  await sql`CREATE TABLE IF NOT EXISTS alumnos (
    token text PRIMARY KEY, nombre text NOT NULL DEFAULT '',
    perfil jsonb NOT NULL DEFAULT '{}', plan jsonb NOT NULL,
    creado timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS registros (
    id bigserial PRIMARY KEY, token text NOT NULL REFERENCES alumnos(token) ON DELETE CASCADE,
    fecha date NOT NULL DEFAULT (timezone('America/Argentina/Buenos_Aires', now())::date),
    microciclo text, sesion int, ejercicio text, serie int, kg numeric, reps int)`;
  await sql`CREATE TABLE IF NOT EXISTS feedback (
    id bigserial PRIMARY KEY, token text NOT NULL REFERENCES alumnos(token) ON DELETE CASCADE,
    creado timestamptz NOT NULL DEFAULT now(), datos jsonb NOT NULL)`;
})().catch(e => { ready = null; throw e; });

const sign = () => createHmac('sha256', SECRET).update('coach').digest('hex');
const isCoach = req => {
  const c = (req.headers.cookie || '').split(/;\s*/).find(x => x.startsWith('coach='));
  if (!c || !PASS) return false;
  const a = Buffer.from(c.slice(6)), b = Buffer.from(sign());
  return a.length === b.length && timingSafeEqual(a, b);
};
const fail = (code, msg) => Object.assign(new Error(msg), { code });
const txt = (v, n = 500) => String(v ?? '').slice(0, n);

const regs = token => sql`SELECT to_char(fecha,'DD/MM/YYYY') AS fecha, microciclo, sesion, ejercicio, serie, kg::float8 AS kg, reps
  FROM registros WHERE token = ${token} ORDER BY id`;
const fbs = async (token, coach) => coach
  ? { feedback: await sql`SELECT creado, datos FROM feedback WHERE token = ${token} ORDER BY id DESC` }
  : {};
const nfb = async token => +(await sql`SELECT count(*)::int AS n FROM feedback WHERE token = ${token}`)[0].n;

export default async function handler(req, res) {
  try {
    await init();
    const seg = new URL(req.url, 'http://x').pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const m = req.method, b = req.body || {}, coach = isCoach(req);
    const need = () => { if (!coach) throw fail(401, 'Solo el profe puede hacer esto.'); };
    const ok = d => res.status(200).json(d);

    if (seg[0] === 'me') return ok({ coach });

    if (seg[0] === 'login' && m === 'POST') {
      if (!PASS) throw fail(500, 'Falta configurar COACH_PASSWORD en Vercel.');
      if (b.password !== PASS) throw fail(401, 'Contraseña incorrecta.');
      res.setHeader('Set-Cookie', `coach=${sign()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
      return ok({ coach: true });
    }
    if (seg[0] === 'logout') {
      res.setHeader('Set-Cookie', 'coach=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
      return ok({});
    }

    if (seg[0] === 'alumnos') {
      need();
      if (m === 'GET') return ok({ alumnos: await sql`SELECT token, nombre FROM alumnos ORDER BY lower(nombre)` });
      if (m === 'POST') {
        const token = randomBytes(9).toString('base64url'), nombre = txt(b.nombre, 80).trim();
        if (!nombre) throw fail(400, 'Falta el nombre.');
        await sql`INSERT INTO alumnos (token, nombre, plan) VALUES (${token}, ${nombre}, ${JSON.stringify(PLAN0)}::jsonb)`;
        return ok({ token });
      }
    }

    if (seg[0] === 'a' && seg[1]) {
      const token = seg[1], sub = seg[2];
      const [al] = await sql`SELECT nombre, perfil, plan FROM alumnos WHERE token = ${token}`;
      if (!al) throw fail(404, 'No encontramos a este alumno. Revisá el link.');

      if (!sub && m === 'GET') return ok({ ...al, registros: await regs(token), nfb: await nfb(token), ...await fbs(token, coach) });
      if (!sub && m === 'DELETE') { need(); await sql`DELETE FROM alumnos WHERE token = ${token}`; return ok({}); }

      if (sub === 'perfil' && m === 'PUT') {
        const p = b.perfil || {}, perfil = {};
        for (const k of ['nac', 'alt', 'dep', 'club', 'les', 'obj']) perfil[k] = txt(p[k]);
        await sql`UPDATE alumnos SET nombre = ${txt(b.nombre, 80)}, perfil = ${JSON.stringify(perfil)}::jsonb WHERE token = ${token}`;
        return ok({});
      }
      if (sub === 'plan' && m === 'PUT') {
        need();
        if (!Array.isArray(b.plan) || !b.plan.length) throw fail(400, 'Plan inválido.');
        await sql`UPDATE alumnos SET plan = ${JSON.stringify(b.plan)}::jsonb WHERE token = ${token}`;
        return ok({});
      }
      if (sub === 'registros' && m === 'POST') {
        const rows = (Array.isArray(b.series) ? b.series : []).slice(0, 300).filter(s => Number.isFinite(+s.kg) && Number.isFinite(+s.reps));
        if (rows.length) await sql.transaction(rows.map(s => sql`INSERT INTO registros (token, microciclo, sesion, ejercicio, serie, kg, reps)
          VALUES (${token}, ${txt(b.microciclo, 80)}, ${+b.sesion || 1}, ${txt(s.ejercicio, 120)}, ${+s.serie || 1}, ${+s.kg}, ${+s.reps})`));
        return ok({ n: rows.length, registros: await regs(token) });
      }
      if (sub === 'registros' && m === 'DELETE') { need(); await sql`DELETE FROM registros WHERE token = ${token}`; return ok({}); }
      if (sub === 'feedback' && m === 'POST') {
        const n = k => Math.min(5, Math.max(1, +b[k] || 3));
        const datos = { mot: n('mot'), rec: n('rec'), esf: n('esf'), dol: n('dol'), sue: txt(b.sue, 10), com: txt(b.com, 1000) };
        await sql`INSERT INTO feedback (token, datos) VALUES (${token}, ${JSON.stringify(datos)}::jsonb)`;
        return ok({ nfb: await nfb(token), ...await fbs(token, coach) });
      }
    }
    throw fail(404, 'Ruta no encontrada.');
  } catch (e) {
    if (!e.code) console.error(e);
    res.status(e.code || 500).json({ error: e.code ? e.message : 'Error del servidor. Revisá DATABASE_URL.' });
  }
}
