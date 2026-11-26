// Espaço compartilhado da equipe: guarda o documento JSON do plano no banco Redis (Upstash)
// ligado ao projeto na Vercel. A Vercel cria as variáveis de ambiente sozinha ao conectar o banco.
//   POST /api/blob          cria um espaço e devolve { id }
//   GET  /api/blob?id=...   lê o documento
//   PUT  /api/blob?id=...   grava o documento
//   GET  /api/blob?status=1 diz se o banco está conectado
import { randomBytes } from "node:crypto";

// Aceita os nomes que a Vercel/Upstash criam, inclusive com prefixo personalizado (ex.: STORAGE_KV_REST_API_URL).
const envKey = (re) => Object.keys(process.env).find((k) => re.test(k));
const kUrl = envKey(/(^|_)KV_REST_API_URL$/) || envKey(/REDIS_REST_URL$/);
const kTok = envKey(/(^|_)KV_REST_API_TOKEN$/) || envKey(/REDIS_REST_TOKEN$/);
const URL_ = kUrl && process.env[kUrl];
const TOKEN = kTok && process.env[kTok];
const MAX = 1_000_000;
const TTL = 60 * 60 * 24 * 365; // 1 ano sem uso

async function redis(cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `redis ${r.status}`);
  return j.result;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.query.status) {
    // só os nomes das variáveis relacionadas, nunca os valores
    const nomes = Object.keys(process.env).filter((k) => /KV|REDIS|UPSTASH/.test(k));
    return res.status(200).json({ conectado: Boolean(URL_ && TOKEN), variaveis: nomes });
  }
  if (!URL_ || !TOKEN) return res.status(503).json({ erro: "banco não conectado" });
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (id && !/^[\w-]{6,80}$/.test(id)) return res.status(400).json({ erro: "id inválido" });
  const key = (k) => `plano:${k}`;
  try {
    if (req.method === "POST" && !id) {
      const body = JSON.stringify(req.body ?? {});
      if (body.length > MAX) return res.status(413).json({ erro: "documento grande demais" });
      const nid = randomBytes(9).toString("base64url");
      await redis(["SET", key(nid), body, "EX", TTL]);
      return res.status(201).json({ id: nid });
    }
    if (req.method === "GET" && id) {
      const v = await redis(["GET", key(id)]);
      if (v == null) return res.status(404).json({ erro: "espaço não encontrado" });
      return res.status(200).setHeader("Content-Type", "application/json").send(v);
    }
    if (req.method === "PUT" && id) {
      const body = JSON.stringify(req.body ?? {});
      if (body.length > MAX) return res.status(413).json({ erro: "documento grande demais" });
      await redis(["SET", key(id), body, "EX", TTL]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ erro: "método não suportado" });
  } catch (e) {
    return res.status(502).json({ erro: "banco indisponível", detalhe: String(e) });
  }
}
