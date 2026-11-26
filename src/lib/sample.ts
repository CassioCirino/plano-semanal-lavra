import type { Atividade } from "./types";
import { HOUR, weekStart } from "./time";

/** Gera uma semana de exemplo alinhada à semana atual, com andamento coerente com "agora". */
export function sampleWeek(now: number): Atividade[] {
  const ws = weekStart(now);
  const at = (d: number, h: number) => new Date(ws + (d * 24 + h) * HOUR).toISOString();
  const elapsed = (d0: number, h0: number, d1: number, h1: number) => {
    const i = ws + (d0 * 24 + h0) * HOUR, f = ws + (d1 * 24 + h1) * HOUR;
    return now <= i ? 0 : now >= f ? 1 : (now - i) / (f - i);
  };
  const ts = new Date(now).toISOString();
  type Seed = [string, Atividade["tipo"], string, string, string, [number, number, number, number], number, string, number, boolean, string, string];
  // nome, tipo, frente, local, equip, [d0,h0,d1,h1], meta, un, fator de ritmo, crítica, motivo, obs
  const seeds: Seed[] = [
    ["Perfuração primária", "geo", "Cava Norte", "Bancada 820", "PF-01 · Perfuratriz D65", [0, 7, 1, 19], 2400, "m", 1.15, false, "", ""],
    ["Desmonte (fogo)", "geo", "Cava Norte", "Bancada 820", "Equipe de desmonte", [2, 11, 2, 13], 1, "fogo", 0, true, "Chuva", "Fogo reprogramado se o tempo abrir."],
    ["Lavra de ROM → UTM", "rom", "Cava Norte", "Bancada 810", "ESC-01 PC2000 + 6× CAT 777", [0, 7, 4, 19], 30000, "t", 0.93, true, "", ""],
    ["Remoção de estéril → PDE-02", "est", "Cava Norte", "Bancada 830", "ESC-03 PC2000 + 8× CAT 777", [0, 7, 6, 7], 45000, "t", 1.18, false, "", ""],
    ["Abertura de acesso", "geo", "Cava Norte", "Rampa R-3, cota 815→800", "Trator D8 + MN-01", [0, 7, 2, 19], 350, "m", 0.76, true, "Frente não liberada", "Aguardando liberação da topografia no trecho final."],
    ["Lavra de ROM → UTM", "rom", "Cava Sul", "Bancada 795", "ESC-02 PC1250 + 4× CAT 777", [1, 7, 4, 19], 18000, "t", 0.6, false, "Quebra de equipamento", "ESC-02 parada 9 h (mangueira hidráulica)."],
    ["Remoção de estéril → PDE-02", "est", "Cava Sul", "Bancada 805", "ESC-04 CAT 374 + 3× CAT 775", [2, 7, 4, 19], 22000, "t", 0.98, false, "", ""],
    ["Perfuração primária", "geo", "Cava Sul", "Bancada 785", "PF-02 · Perfuratriz DM45", [3, 7, 5, 19], 1800, "m", 1, false, "", ""],
    ["Conformação de berma", "geo", "PDE-02", "Berma 4, cota 760", "Trator D9", [3, 7, 4, 19], 6500, "m²", 1, false, "", ""],
    ["Drenagem e manutenção de acessos", "geo", "Infraestrutura", "Acessos principais", "MN-01 + caminhão-pipa", [0, 7, 6, 19], 12, "km", 1.05, false, "", ""],
    ["Manutenção de equipamento", "geo", "Oficina", "Preventiva 500 h ESC-02", "ESC-02 PC1250", [5, 7, 5, 19], 12, "h", 1, false, "", ""],
  ];
  return seeds.map((s, k) => {
    const [nome, tipo, frente, local, equip, [d0, h0, d1, h1], meta, un, fator, critica, motivo, obs] = s;
    const e = elapsed(d0, h0, d1, h1);
    let real = Math.min(meta, meta * e * fator);
    real = un === "t" ? Math.round(real / 10) * 10 : un === "fogo" ? (e >= 1 && fator > 0 ? 1 : 0) : Math.round(real * 10) / 10;
    const started = real > 0;
    const done = real >= meta;
    return {
      id: "EX" + String(k + 1).padStart(2, "0"),
      nome, tipo, frente, local, equip,
      ini: at(d0, h0), fim: at(d1, h1), meta, un, real,
      iniReal: started ? at(d0, h0 + (k % 3 === 1 ? 1 : 0)) : null,
      fimReal: done ? new Date(Math.min(now, ws + (d1 * 24 + h1 - 2) * HOUR)).toISOString() : null,
      critica,
      motivo: started && fator < 0.9 || (fator === 0 && e > 0) ? motivo : "",
      obs: started && fator < 0.9 || (fator === 0 && e > 0) ? obs : "",
      updatedAt: ts,
    };
  });
}

/** Semanas anteriores (só movimentação), para o histórico de aderência e o acumulado do mês. */
export function sampleHistory(now: number, weeks = 8): Atividade[] {
  const ws0 = weekStart(now);
  const ritmo = [0.78, 0.84, 0.74, 0.87, 0.9, 0.83, 0.93, 0.88, 0.8, 0.86];
  const motivos = ["Chuva", "Quebra de equipamento", "Falta de caminhão", "Frente não liberada", "Chuva", "Detonação atrasada"];
  const out: Atividade[] = [];
  const base = sampleWeek(ws0 + 7 * 24 * HOUR * 2).filter((a) => a.tipo !== "geo");
  for (let k = 1; k <= weeks; k++) {
    const shift = -(7 * (k + 2)) * 24 * HOUR;
    base.forEach((a, j) => {
      const f = Math.min(1, ritmo[(k + j) % ritmo.length] + (j % 2 ? 0.06 : 0));
      const real = Math.round((a.meta * f) / 10) * 10;
      const ini = new Date(new Date(a.ini).getTime() + shift).toISOString();
      const fim = new Date(new Date(a.fim).getTime() + shift).toISOString();
      out.push({
        ...a, id: `H${k}-${j}`, ini, fim, real, iniReal: ini, fimReal: fim, critica: false,
        motivo: f < 0.9 ? motivos[(k + j) % motivos.length] : "", obs: "",
      });
    });
  }
  return out;
}

/**
 * Mês de exemplo fechado (janeiro/2026 por padrão): 5 semanas de plano com andamento realizado,
 * período chuvoso (mais desvios por chuva no início do mês), quebras e frentes não liberadas.
 * IDs começam com "J" para poderem ser removidos junto com os demais exemplos.
 */
export function sampleMonth(year = 2026, month = 0): Atividade[] {
  const m0 = new Date(year, month, 1).getTime();
  const m1 = new Date(year, month + 1, 1).getTime();
  const out: Atividade[] = [];
  const ts = new Date().toISOString();
  // ritmo médio de cada semana (chuva forte nas duas primeiras)
  const ritmoSemana = [0.7, 0.76, 0.9, 0.95, 0.88];
  const motivosSemana = [["Chuva", "Chuva", "Frente não liberada"], ["Chuva", "Quebra de equipamento", "Chuva"], ["Quebra de equipamento", "Falta de caminhão", "Geologia / teor"], ["Detonação atrasada", "Falta de caminhão", "Quebra de equipamento"], ["Chuva", "Frente não liberada", "Quebra de equipamento"]];
  const jit = [1.08, 0.92, 1.03, 0.97, 1.11, 0.86, 1.0, 0.94, 1.06, 0.9, 1.02];
  let k = 0;
  for (let ws = weekStart(m0), w = 0; ws < m1; ws += 7 * 24 * HOUR, w++) {
    const at = (d: number, h: number) => ws + (d * 24 + h) * HOUR;
    const cotaN = 820 - w * 5, cotaS = 795 - w * 5;
    type T = [string, Atividade["tipo"], string, string, string, number, number, number, number, number, string, boolean];
    // nome, tipo, frente, local, equip, d0, h0, d1, h1, meta, un, crítica
    const tpl: T[] = [
      ["Lavra de ROM → UTM", "rom", "Cava Norte", `Bancada ${cotaN}`, "ESC-01 PC2000 + 6× CAT 777", 0, 7, 4, 19, 30000, "t", true],
      ["Lavra de ROM → UTM", "rom", "Cava Sul", `Bancada ${cotaS}`, "ESC-02 PC1250 + 4× CAT 777", 1, 7, 5, 19, 18000, "t", false],
      ["Remoção de estéril → PDE-02", "est", "Cava Norte", `Bancada ${cotaN + 10}`, "ESC-03 PC2000 + 8× CAT 777", 0, 7, 6, 7, 45000, "t", false],
      ["Remoção de estéril → PDE-02", "est", "Cava Sul", `Bancada ${cotaS + 10}`, "ESC-04 CAT 374 + 3× CAT 775", 2, 7, 5, 19, 22000, "t", false],
      ["Perfuração primária", "geo", "Cava Norte", `Bancada ${cotaN - 10}`, "PF-01 · Perfuratriz D65", 0, 7, 2, 19, 2600, "m", false],
      ["Desmonte (fogo)", "geo", "Cava Norte", `Bancada ${cotaN - 10}`, "Equipe de desmonte", 3, 11, 3, 13, 1, "fogo", true],
      ["Perfuração primária", "geo", "Cava Sul", `Bancada ${cotaS - 10}`, "PF-02 · Perfuratriz DM45", 2, 7, 4, 19, 1800, "m", false],
      ["Conformação de berma", "geo", "PDE-02", `Berma ${3 + w}, cota ${770 - w * 5}`, "Trator D9", 3, 7, 4, 19, 6000, "m²", false],
      ["Drenagem e manutenção de acessos", "geo", "Infraestrutura", "Acessos principais e canaletas", "MN-01 + caminhão-pipa", 0, 7, 6, 19, 14, "km", false],
      ["Manutenção de equipamento", "geo", "Oficina", w % 2 ? "Preventiva 500 h ESC-01" : "Preventiva 250 h CAT 777 (frota)", w % 2 ? "ESC-01 PC2000" : "6× CAT 777", 5, 7, 5, 19, 12, "h", false],
    ];
    tpl.forEach((t, j) => {
      const [nome, tipo, frente, local, equip, d0, h0, d1, h1, meta, un, critica] = t;
      const ini = at(d0, h0), fim = at(d1, h1);
      if (ini < m0 || ini >= m1) return; // só atividades que começam no mês
      const f = Math.min(1, ritmoSemana[w % ritmoSemana.length] * jit[(j + w * 3) % jit.length] + (tipo === "geo" ? 0.06 : 0));
      let real = meta * f;
      real = un === "t" ? Math.round(real / 10) * 10 : un === "fogo" ? (f > 0.8 ? 1 : 0) : un === "h" ? meta : Math.round(real * 10) / 10;
      const done = real >= meta;
      const late = !done;
      out.push({
        id: `J${year % 100}${String(month + 1).padStart(2, "0")}-${w}-${j}`,
        nome, tipo, frente, local, equip,
        ini: new Date(ini).toISOString(), fim: new Date(fim).toISOString(), meta, un, real,
        iniReal: new Date(ini + (j % 3 === 1 ? HOUR : 0)).toISOString(),
        fimReal: done ? new Date(fim - (j % 2 ? 3 : 0) * HOUR).toISOString() : null,
        critica,
        motivo: late ? motivosSemana[w % motivosSemana.length][(j + k) % 3] : "",
        obs: late && j === 0 ? "Frente com lama após chuva; carregamento parado por parte do turno." : "",
        updatedAt: ts,
      });
      k++;
    });
  }
  return out;
}
