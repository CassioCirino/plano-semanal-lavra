import * as XLSX from "xlsx";
import type { Atividade, Config, Tipo } from "./types";
import { ST_LABEL } from "./types";
import { daily, expct, indicators, isMass, pct, status } from "./calc";
import { DIAS, addDays, fmtDate, ms, weekKey, weekLabel, weekStart } from "./time";
import { newId } from "./store";

const COLS = [
  "ID", "Semana", "Frente", "Local", "Atividade", "Tipo", "Equipamento",
  "Início planejado", "Fim planejado", "Meta", "Unidade", "Realizado", "% realizado", "% previsto",
  "Início real", "Fim real", "Status", "Crítica", "Motivo do desvio", "Observação",
] as const;

const TIPO_TXT: Record<Tipo, string> = { rom: "ROM", est: "Estéril", geo: "Geometria" };

/** Exporta as atividades (da semana ou todas) + resumo de aderência e movimentação diária. */
export function exportPlano(acts: Atividade[], ws: number, now: number, cfg: Config, escopo: "semana" | "tudo") {
  const wb = XLSX.utils.book_new();
  const rows = acts
    .slice()
    .sort((a, b) => ms(a.ini) - ms(b.ini))
    .map((a) => ({
      ID: a.id,
      Semana: weekKey(weekStart(ms(a.ini))),
      Frente: a.frente,
      Local: a.local,
      Atividade: a.nome,
      Tipo: TIPO_TXT[a.tipo],
      Equipamento: a.equip,
      "Início planejado": new Date(a.ini),
      "Fim planejado": new Date(a.fim),
      Meta: a.meta,
      Unidade: a.un,
      Realizado: a.real,
      "% realizado": Math.round(pct(a)) / 100,
      "% previsto": Math.round(expct(a, now)) / 100,
      "Início real": a.iniReal ? new Date(a.iniReal) : "",
      "Fim real": a.fimReal ? new Date(a.fimReal) : "",
      Status: ST_LABEL[status(a, now)],
      "Crítica": a.critica ? "Sim" : "Não",
      "Motivo do desvio": a.motivo,
      "Observação": a.obs,
    }));
  const ws1 = XLSX.utils.json_to_sheet(rows, { header: [...COLS], cellDates: true, dateNF: "dd/mm/yyyy hh:mm" });
  ws1["!cols"] = [10, 10, 14, 22, 30, 10, 28, 17, 17, 10, 8, 11, 11, 11, 17, 17, 12, 8, 22, 40].map((w) => ({ wch: w }));
  // formato de porcentagem
  const range = XLSX.utils.decode_range(ws1["!ref"] ?? "A1");
  for (let r = 1; r <= range.e.r; r++) for (const c of [12, 13]) {
    const cell = ws1[XLSX.utils.encode_cell({ r, c })];
    if (cell) cell.z = "0%";
  }
  XLSX.utils.book_append_sheet(wb, ws1, "Plano");

  if (escopo === "semana") {
    const I = indicators(acts, now);
    const { week, range: rg } = weekLabel(ws);
    const resumo = [
      ["Plano Semanal de Lavra", ""],
      ["Semana", `${week} · ${rg}`],
      ["Gerado em", fmtDate(now)],
      [],
      ["Indicador", "Valor"],
      ["Aderência em movimentação", I.aderMov / 100],
      ["Aderência em geometria", I.aderGeo / 100],
      ["Cumprimento (realizado ÷ planejado até agora)", I.cumpr / 100],
      ["Movimentação realizada (t)", I.weekReal],
      ["Movimentação planejada na semana (t)", I.weekPlan],
      ["Capacidade da UTM (t/dia)", cfg.capUTM],
      [],
      ["Status", "Atividades"],
      ...(["crit", "late", "ok", "ahead", "done", "prog"] as const).map((s) => [ST_LABEL[s], acts.filter((a) => status(a, now) === s).length]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(resumo);
    for (const r of [5, 6, 7]) { const c = ws2[XLSX.utils.encode_cell({ r, c: 1 })]; if (c) c.z = "0%"; }
    ws2["!cols"] = [{ wch: 46 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Aderência");

    const D = daily(acts, ws, now);
    const dia = [["Dia", "ROM planejado (t)", "ROM realizado (t)", "Estéril planejado (t)", "Estéril realizado (t)", "Total planejado (t)", "Total realizado (t)"],
      ...D.map((o, i) => {
        const d = new Date(addDays(ws, i));
        return [`${DIAS[i]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
          Math.round(o.romP), Math.round(o.romR), Math.round(o.estP), Math.round(o.estR), Math.round(o.romP + o.estP), Math.round(o.romR + o.estR)];
      })];
    const ws3 = XLSX.utils.aoa_to_sheet(dia);
    ws3["!cols"] = dia[0].map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws3, "Por dia");
  }
  const nome = escopo === "semana" ? `plano-semanal-${weekKey(ws)}.xlsx` : `plano-lavra-completo.xlsx`;
  XLSX.writeFile(wb, nome, { compression: true });
}

/** Planilha modelo, no mesmo formato da exportação, para preencher o plano. */
export function exportModelo(ws: number) {
  const d = (dia: number, h: number) => new Date(addDays(ws, dia) + h * 3600000);
  const rows = [
    { Frente: "Cava Norte", Local: "Bancada 810", Atividade: "Lavra de ROM → UTM", Tipo: "ROM", Equipamento: "ESC-01 PC2000 + 6× CAT 777", "Início planejado": d(0, 7), "Fim planejado": d(4, 19), Meta: 30000, Unidade: "t", "Crítica": "Sim" },
    { Frente: "Cava Norte", Local: "Bancada 830", Atividade: "Remoção de estéril → PDE-02", Tipo: "Estéril", Equipamento: "ESC-03 PC2000 + 8× CAT 777", "Início planejado": d(0, 7), "Fim planejado": d(6, 7), Meta: 45000, Unidade: "t", "Crítica": "Não" },
    { Frente: "Cava Sul", Local: "Bancada 785", Atividade: "Perfuração primária", Tipo: "Geometria", Equipamento: "PF-02", "Início planejado": d(3, 7), "Fim planejado": d(5, 19), Meta: 1800, Unidade: "m", "Crítica": "Não" },
  ];
  const sh = XLSX.utils.json_to_sheet(rows, { header: [...COLS], cellDates: true, dateNF: "dd/mm/yyyy hh:mm" });
  sh["!cols"] = COLS.map((c) => ({ wch: Math.max(10, c.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sh, "Plano");
  const help = XLSX.utils.aoa_to_sheet([
    ["Como preencher"],
    ["Uma linha por atividade. Colunas obrigatórias: Atividade, Frente, Início planejado, Fim planejado, Meta, Unidade."],
    ["Tipo: ROM (vai para a UTM), Estéril (vai para a pilha) ou Geometria (perfuração, desmonte, acessos, bermas, manutenção)."],
    ["Datas: dd/mm/aaaa hh:mm. Deixe o ID em branco para atividades novas; com o ID, a linha atualiza a atividade existente."],
    ["Realizado, Início real, Fim real e Motivo do desvio são opcionais e servem para importar o andamento."],
  ]);
  help["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, help, "Instruções");
  XLSX.writeFile(wb, `modelo-plano-semanal-${weekKey(ws)}.xlsx`);
}

export interface ImportResult { novas: Atividade[]; atualizadas: Atividade[]; erros: string[] }

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
const ALIASES: Record<string, string[]> = {
  id: ["id", "codigo", "cod"],
  frente: ["frente", "cava", "area"],
  local: ["local", "bancada", "frente local"],
  nome: ["atividade", "descricao", "tarefa"],
  tipo: ["tipo", "material"],
  equip: ["equipamento", "equipamentos", "frota"],
  ini: ["inicio planejado", "inicio", "inicio plan", "data inicio"],
  fim: ["fim planejado", "fim", "termino", "termino planejado", "fim plan", "data fim"],
  meta: ["meta", "quantidade", "qtd planejada", "planejado"],
  un: ["unidade", "un", "und"],
  real: ["realizado", "qtd realizada", "executado"],
  iniReal: ["inicio real"],
  fimReal: ["fim real", "termino real"],
  critica: ["critica", "caminho critico"],
  motivo: ["motivo do desvio", "motivo", "causa"],
  obs: ["observacao", "obs", "observacoes", "comentario"],
};

function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  if (typeof v === "number") {
    const p = XLSX.SSF.parse_date_code(v);
    if (!p) return null;
    return new Date(p.y, p.m - 1, p.d, p.H, p.M, Math.round(p.S)).toISOString();
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T]+(\d{1,2})(?::|h)?(\d{2})?)?/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return new Date(y, +m[2] - 1, +m[1], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0).toISOString();
  }
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t).toISOString();
}
const parseNum = (v: unknown) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim().replace(/\s|t$/gi, "");
  if (!s) return NaN;
  // 30.000 ou 30.000,5 (pt-BR) vs 30000.5
  const n = /,/.test(s) ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  return parseFloat(n);
};
const parseTipo = (v: unknown, nome: string, un: string): Tipo => {
  const s = norm(v) + " " + norm(nome);
  if (/\brom\b|minerio|utm/.test(s)) return "rom";
  if (/esteril|pde|pilha/.test(s)) return "est";
  if (un === "t" && /lavra/.test(s)) return "rom";
  return "geo";
};

export async function importPlano(file: File, existentes: Atividade[]): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.find((n) => norm(n) === "plano") ?? wb.SheetNames[0];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "", raw: true });
  const res: ImportResult = { novas: [], atualizadas: [], erros: [] };
  if (!raw.length) { res.erros.push("A planilha está vazia."); return res; }
  const headers = Object.keys(raw[0]);
  const col: Record<string, string | undefined> = {};
  for (const [k, al] of Object.entries(ALIASES)) col[k] = headers.find((h) => al.includes(norm(h)));
  const faltam = ["nome", "ini", "fim", "meta"].filter((k) => !col[k]);
  if (faltam.length) {
    const nomes: Record<string, string> = { nome: "Atividade", ini: "Início planejado", fim: "Fim planejado", meta: "Meta" };
    res.erros.push(`Colunas não encontradas: ${faltam.map((k) => nomes[k]).join(", ")}. Use a planilha modelo.`);
    return res;
  }
  const byId = new Map(existentes.map((a) => [a.id, a]));
  const g = (r: Record<string, unknown>, k: string) => (col[k] ? r[col[k]!] : "");
  const ts = new Date().toISOString();
  raw.forEach((r, i) => {
    const linha = i + 2;
    const nome = String(g(r, "nome")).trim();
    if (!nome) return; // linha vazia
    const ini = parseDate(g(r, "ini")), fim = parseDate(g(r, "fim"));
    const meta = parseNum(g(r, "meta"));
    if (!ini || !fim) { res.erros.push(`Linha ${linha}: data de início ou fim inválida.`); return; }
    if (ms(fim) <= ms(ini)) { res.erros.push(`Linha ${linha}: o fim planejado é antes do início.`); return; }
    if (!(meta > 0)) { res.erros.push(`Linha ${linha}: meta inválida.`); return; }
    const un = String(g(r, "un") || "t").trim() || "t";
    const realN = parseNum(g(r, "real"));
    const id = String(g(r, "id")).trim();
    const prev = id ? byId.get(id) : undefined;
    const a: Atividade = {
      id: prev?.id ?? (id || newId()),
      nome,
      tipo: parseTipo(g(r, "tipo"), nome, un),
      frente: String(g(r, "frente") || prev?.frente || "Cava Norte").trim(),
      local: String(g(r, "local") || prev?.local || "—").trim(),
      equip: String(g(r, "equip") || prev?.equip || "—").trim(),
      ini, fim, meta, un,
      real: isNaN(realN) ? prev?.real ?? 0 : Math.max(0, realN),
      iniReal: parseDate(g(r, "iniReal")) ?? prev?.iniReal ?? null,
      fimReal: parseDate(g(r, "fimReal")) ?? prev?.fimReal ?? null,
      critica: /^(s|sim|x|1|true|verdadeiro)$/i.test(norm(g(r, "critica"))) || (!col.critica && !!prev?.critica),
      motivo: String(g(r, "motivo") || prev?.motivo || "").trim(),
      obs: String(g(r, "obs") || prev?.obs || "").trim(),
      updatedAt: ts,
    };
    (prev ? res.atualizadas : res.novas).push(a);
  });
  return res;
}

export const massOf = (acts: Atividade[]) => acts.filter(isMass);
