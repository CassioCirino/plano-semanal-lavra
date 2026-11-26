export const HOUR = 3600000;
export const DAY = 24 * HOUR;
export const WEEK_H = 168;
export const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const DIAS_FULL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MESES_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function weekStart(d: Date | number): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x.getTime();
}
export function addDays(t: number, n: number): number {
  const x = new Date(t);
  x.setDate(x.getDate() + n);
  return x.getTime();
}
export function isoWeek(t: number): { year: number; week: number } {
  const d = new Date(t);
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dn = (u.getUTCDay() + 6) % 7;
  u.setUTCDate(u.getUTCDate() - dn + 3);
  const fy = u.getUTCFullYear();
  const ft = new Date(Date.UTC(fy, 0, 4));
  const w = 1 + Math.round(((u.getTime() - ft.getTime()) / 86400000 - 3 + ((ft.getUTCDay() + 6) % 7)) / 7);
  return { year: fy, week: w };
}
export const weekLabel = (ws: number) => {
  const { week } = isoWeek(ws);
  const a = new Date(ws), b = new Date(addDays(ws, 6));
  const range = a.getMonth() === b.getMonth()
    ? `${a.getDate()} a ${b.getDate()} ${MESES[b.getMonth()]} ${b.getFullYear()}`
    : `${a.getDate()} ${MESES[a.getMonth()]} a ${b.getDate()} ${MESES[b.getMonth()]} ${b.getFullYear()}`;
  return { week, range };
};
export const weekKey = (ws: number) => {
  const { year, week } = isoWeek(ws);
  return `${year}-S${String(week).padStart(2, "0")}`;
};
export const monthKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
export const ms = (iso: string) => new Date(iso).getTime();
const p2 = (n: number) => String(n).padStart(2, "0");
export const fmtHM = (t: number) => {
  const d = new Date(t);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
export const fmtDH = (t: number) => {
  const d = new Date(t);
  return `${DIAS[(d.getDay() + 6) % 7]} ${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${fmtHM(t)}`;
};
export const fmtDate = (t: number) => {
  const d = new Date(t);
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${fmtHM(t)}`;
};
/** valor para <input type="datetime-local"> */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
export const ovl = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
