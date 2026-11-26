// Proxy do espaço compartilhado da equipe (jsonblob.com).
// O navegador fala só com o próprio site (/api/blob), sem depender de CORS do serviço externo.
//   POST /api/blob          cria um espaço e devolve { id }
//   GET  /api/blob?id=...   lê o documento
//   PUT  /api/blob?id=...   grava o documento
const UPSTREAM = "https://jsonblob.com/api/jsonBlob";
const MAX = 2_000_000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (id && !/^[\w-]{6,80}$/.test(id)) return res.status(400).json({ erro: "id inválido" });
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  try {
    if (req.method === "POST" && !id) {
      const body = JSON.stringify(req.body ?? {});
      if (body.length > MAX) return res.status(413).json({ erro: "documento grande demais" });
      const r = await fetch(UPSTREAM, { method: "POST", headers, body });
      if (!r.ok) return res.status(502).json({ erro: "falha ao criar", status: r.status });
      const loc = r.headers.get("location") || r.headers.get("x-jsonblob-id") || "";
      const nid = loc.split("/").filter(Boolean).pop();
      if (!nid) return res.status(502).json({ erro: "serviço não devolveu o id" });
      return res.status(201).json({ id: nid });
    }
    if (req.method === "GET" && id) {
      const r = await fetch(`${UPSTREAM}/${id}`, { headers });
      if (!r.ok) return res.status(r.status === 404 ? 404 : 502).json({ erro: "falha ao ler", status: r.status });
      return res.status(200).send(await r.text());
    }
    if (req.method === "PUT" && id) {
      const body = JSON.stringify(req.body ?? {});
      if (body.length > MAX) return res.status(413).json({ erro: "documento grande demais" });
      const r = await fetch(`${UPSTREAM}/${id}`, { method: "PUT", headers, body });
      if (!r.ok) return res.status(502).json({ erro: "falha ao gravar", status: r.status });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ erro: "método não suportado" });
  } catch (e) {
    return res.status(502).json({ erro: "serviço indisponível", detalhe: String(e) });
  }
}
