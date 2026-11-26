import type { Atividade, Config, Status } from "./types";
import { DAY, HOUR, addDays, monthKey, ms, ovl, weekStart, DIAS } from "./time";

export const isMass = (a: Atividade) => a.tipo === "rom" || a.tipo === "est";
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const pct = (a: Atividade) => (a.meta > 0 ? clamp((a.real / a.meta) * 100, 0, 100) : 0);
export function expct(a: Atividade, now: number) {
  const i = ms(a.ini), f = ms(a.fim);
  if (now <= i) return 0;
  if (now >= f) return 100;
  return ((now - i) / (f - i)) * 100;
}
export function status(a: Atividade, now: number): Status {
  const p = pct(a), e = expct(a, now);
  if (p >= 99.95) return "done";
  if (e === 0 && p === 0) return "prog";
  const d = p - e;
  if (d >= 5) return "ahead";
  if (d > -5) return "ok";
  if (a.critica || d <= -20) return "crit";
  return "late";
}
export const isBehind = (s: Status) => s === "late" || s === "crit";
export const planToNow = (a: Atividade, now: number) => (a.meta * expct(a, now)) / 100;

/** Atividades da semana: as que começam (planejado) dentro da semana. */
export const ofWeek = (acts: Atividade[], ws: number) => {
  const we = addDays(ws, 7);
  return acts.filter((a) => {
    const i = ms(a.ini);
    return i >= ws && i < we;
  });
};
/** Atividades que aparecem no Gantt da semana (sobrepõem o intervalo). */
export const inWeekRange = (acts: Atividade[], ws: number) => {
  const we = addDays(ws, 7);
  return acts.filter((a) => ovl(ms(a.ini), ms(a.fim), ws, we) > 0);
};

export interface Indic {
  aderMov: number;
  cumpr: number;
  aderGeo: number;
  weekPlan: number;
  weekReal: number;
  planNow: number;
  hasMass: boolean;
  hasGeo: boolean;
}
export function indicators(acts: Atividade[], now: number): Indic {
  let pl = 0, adh = 0, re = 0, gE = 0, gA = 0, weekPlan = 0, weekReal = 0;
  acts.forEach((a) => {
    if (isMass(a)) {
      const p = planToNow(a, now);
      pl += p; adh += Math.min(a.real, p); re += a.real; weekPlan += a.meta; weekReal += a.real;
    } else {
      const e = expct(a, now);
      if (e > 0) { gE += e; gA += Math.min(pct(a), e); }
    }
  });
  return {
    aderMov: pl ? (adh / pl) * 100 : 100,
    cumpr: pl ? (re / pl) * 100 : 100,
    aderGeo: gE ? (gA / gE) * 100 : 100,
    weekPlan, weekReal, planNow: pl, hasMass: pl > 0, hasGeo: gE > 0,
  };
}

export interface DayAgg { romP: number; estP: number; romR: number; estR: number }
export function daily(acts: Atividade[], ws: number, now: number): DayAgg[] {
  const out: DayAgg[] = DIAS.map(() => ({ romP: 0, estP: 0, romR: 0, estR: 0 }));
  acts.filter(isMass).forEach((a) => {
    const i = ms(a.ini), f = ms(a.fim), dur = Math.max(HOUR, f - i);
    const s = a.iniReal ? ms(a.iniReal) : i;
    const endR = Math.min(now, a.fimReal ? ms(a.fimReal) : now);
    const rdur = Math.max(HOUR / 2, endR - s);
    out.forEach((o, d) => {
      const d0 = addDays(ws, d), d1 = addDays(ws, d + 1);
      const p = (a.meta * ovl(d0, d1, i, f)) / dur;
      const r = a.real > 0 && endR > s ? (a.real * ovl(d0, d1, s, endR)) / rdur : 0;
      if (a.tipo === "rom") { o.romP += p; o.romR += r; } else { o.estP += p; o.estR += r; }
    });
  });
  return out;
}

export interface Alerta { kind: "crit" | "late" | "info"; title: string; detail: string; id?: string }
export function alerts(weekActs: Atividade[], ws: number, now: number, cfg: Config, month: MonthStats): Alerta[] {
  const list: Alerta[] = [];
  weekActs.forEach((a) => {
    const s = status(a, now);
    if (isBehind(s)) {
      const d = pct(a) - expct(a, now);
      list.push({
        kind: s === "crit" ? "crit" : "late",
        title: `${s === "crit" ? "Crítica" : "Atraso"}: ${a.nome} · ${a.local}`,
        detail: `${fmt(Math.abs(d))} p.p. abaixo do previsto · ${a.motivo ? "Motivo: " + a.motivo : "Motivo não informado"}`,
        id: a.id,
      });
    }
  });
  const order = { crit: 0, late: 1, info: 2 };
  list.sort((x, y) => order[x.kind] - order[y.kind]);
  daily(weekActs, ws, now).forEach((o, d) => {
    if (o.romP > cfg.capUTM && addDays(ws, d + 1) > now)
      list.push({
        kind: "late",
        title: `ROM programado acima da capacidade da UTM (${DIAS[d]})`,
        detail: `${fmt(o.romP / 1000, 1)} kt planejadas para ${fmt(cfg.capUTM / 1000, 1)} kt/dia. Prever pulmão no pátio de ROM.`,
      });
  });
  if (cfg.pdeCap > 0) {
    const ocup = month.pdeOcupAtual, livre = cfg.pdeCap - ocup;
    const estSem = weekActs.filter((a) => a.tipo === "est").reduce((s, a) => s + a.meta, 0);
    const ocPct = (ocup / cfg.pdeCap) * 100;
    if (livre <= 0) {
      list.unshift({ kind: "crit", title: `${cfg.pdeNome} sem capacidade disponível`, detail: `Ocupação de ${fmt(ocPct)}% da capacidade licenciada.` });
    } else if (estSem > 0 && (livre / estSem < 12 || ocPct >= 75)) {
      list.push({ kind: livre / estSem < 4 ? "late" : "info", title: `${cfg.pdeNome} com ${fmt(ocPct)}% da capacidade ocupada`, detail: `Restam ${fmt(livre / 1000)} kt. No ritmo do plano, cerca de ${fmt(livre / estSem)} semanas de deposição.` });
    }
  }
  return list;
}

export interface MonthStats {
  key: string;
  frac: number;
  rom: number;
  est: number;
  romMeta: number;
  estMeta: number;
  capMov: number;
  pdeOcupAtual: number;
  motivos: [string, number][];
}
export function monthStats(all: Atividade[], now: number, cfg: Config): MonthStats {
  const d = new Date(now);
  const m0 = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const m1 = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  const key = monthKey(now);
  const orc = cfg.orcamento[key] ?? cfg.orcamentoPadrao;
  let rom = 0, est = 0;
  const mot: Record<string, number> = {};
  all.forEach((a) => {
    const i = ms(a.ini);
    if (i < m0 || i >= m1) return;
    if (a.tipo === "rom") rom += a.real;
    if (a.tipo === "est") est += a.real;
    if (a.motivo) {
      const lost = Math.max(0, expct(a, now) - pct(a)) / 100 * ((ms(a.fim) - i) / HOUR);
      mot[a.motivo] = (mot[a.motivo] ?? 0) + Math.max(1, Math.round(lost));
    }
  });
  return {
    key, frac: (now - m0) / (m1 - m0), rom, est, romMeta: orc.rom, estMeta: orc.est, capMov: orc.capMov,
    pdeOcupAtual: cfg.pdeOcup + est,
    motivos: Object.entries(mot).sort((x, y) => y[1] - x[1]),
  };
}

export function history(all: Atividade[], now: number, n = 9): { ws: number; ader: number | null }[] {
  const cur = weekStart(now);
  const out: { ws: number; ader: number | null }[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const ws = addDays(cur, -7 * k);
    const acts = ofWeek(all, ws);
    const ref = Math.min(now, addDays(ws, 7));
    const I = indicators(acts, ref);
    out.push({ ws, ader: I.hasMass ? I.aderMov : null });
  }
  return out;
}

export const fmt = (n: number, dec = 0) =>
  Number(n).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fq = (n: number, un: string) => (un === "km" ? fmt(n, 1) : fmt(n, n % 1 ? 1 : 0)) + " " + un;
export const stepOf = (a: Atividade) =>
  a.un === "t" ? (a.meta >= 25000 ? 1000 : 500) : a.un === "fogo" ? 1 : a.un === "km" ? 0.5 : a.un === "m" ? 25 : a.un === "m²" ? 250 : 1;
export { DAY };
