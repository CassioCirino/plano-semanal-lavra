// Diagnóstico temporário: testa serviços de JSON sem conta a partir da Vercel.
export default async function handler(req, res) {
  const body = JSON.stringify({ teste: true });
  const H = { "Content-Type": "application/json", Accept: "application/json" };
  const tries = {
    jsonblob: () => fetch("https://jsonblob.com/api/jsonBlob", { method: "POST", headers: H, body }),
    extendsclass: () => fetch("https://json.extendsclass.com/bin", { method: "POST", headers: { ...H, "Private": "false" }, body }),
    kvdb: () => fetch("https://kvdb.io", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "" }),
    jsonkeeper: () => fetch("https://www.jsonkeeper.com/b", { method: "POST", headers: H, body }),
    npoint: () => fetch("https://api.npoint.io/bins", { method: "POST", headers: H, body: JSON.stringify({ contents: { teste: true } }) }),
    restdb_jsonbin: () => fetch("https://api.jsonbin.io/v3/b", { method: "POST", headers: H, body }),
  };
  const out = {};
  for (const [k, f] of Object.entries(tries)) {
    try { const r = await f(); out[k] = { status: r.status, loc: r.headers.get("location"), body: (await r.text()).slice(0, 200) }; }
    catch (e) { out[k] = { erro: String(e) }; }
  }
  res.status(200).json(out);
}
