export type Tipo = "rom" | "est" | "geo";
export type Status = "ok" | "ahead" | "late" | "crit" | "done" | "prog";

export interface Atividade {
  id: string;
  nome: string;
  tipo: Tipo;
  frente: string;
  local: string;
  equip: string;
  ini: string; // ISO, início planejado
  fim: string; // ISO, fim planejado
  meta: number;
  un: string;
  real: number;
  iniReal: string | null;
  fimReal: string | null;
  critica: boolean;
  motivo: string;
  obs: string;
  updatedAt: string;
}

export interface OrcamentoMes {
  rom: number; // t de ROM para a UTM no mês
  est: number; // t de estéril para a pilha no mês
  capMov: number; // capacidade de movimentação total no mês (t)
}

export interface Config {
  capUTM: number; // t/dia
  metaAderencia: number; // %
  pdeNome: string;
  pdeCap: number; // t
  pdeOcup: number; // t ocupadas no início do mês corrente
  orcamento: Record<string, OrcamentoMes>; // chave "2026-11"
  orcamentoPadrao: OrcamentoMes;
}

export const FRENTES = ["Cava Norte", "Cava Sul", "PDE-02", "Infraestrutura", "Oficina"];
export const MOTIVOS = [
  "Chuva",
  "Quebra de equipamento",
  "Frente não liberada",
  "Falta de caminhão",
  "Detonação atrasada",
  "Geologia / teor",
  "Outro",
];
export const ST_LABEL: Record<Status, string> = {
  ok: "No prazo",
  ahead: "Adiantada",
  late: "Atrasada",
  crit: "Crítica",
  done: "Concluída",
  prog: "Programada",
};
export const TIPOS: { tipo: Tipo; nome: string; un: string }[] = [
  { tipo: "rom", nome: "Lavra de ROM → UTM", un: "t" },
  { tipo: "est", nome: "Remoção de estéril → PDE-02", un: "t" },
  { tipo: "geo", nome: "Perfuração primária", un: "m" },
  { tipo: "geo", nome: "Desmonte (fogo)", un: "fogo" },
  { tipo: "geo", nome: "Abertura de acesso", un: "m" },
  { tipo: "geo", nome: "Conformação de berma", un: "m²" },
  { tipo: "geo", nome: "Drenagem e manutenção de acessos", un: "km" },
  { tipo: "geo", nome: "Manutenção de equipamento", un: "h" },
];

export const DEFAULT_CONFIG: Config = {
  capUTM: 11000,
  metaAderencia: 85,
  pdeNome: "PDE-02",
  pdeCap: 2400000,
  pdeOcup: 1912000,
  orcamento: {},
  orcamentoPadrao: { rom: 210000, est: 290000, capMov: 560000 },
};
