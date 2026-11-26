import type { ReactNode } from "react";
import type { Atividade, Status } from "./lib/types";
import { ST_LABEL } from "./lib/types";
import { expct, fmt, fq, isBehind, pct, status } from "./lib/calc";
import { addDays, ms, ovl } from "./lib/time";

export function Pill({ s }: { s: Status }) {
  return <span className={`pill s-${s}`}>{ST_LABEL[s]}</span>;
}
export const CritMark = ({ a }: { a: Atividade }) =>
  a.critica ? <span className="crit-mark" title="Atividade crítica">◆</span> : null;

export function ActCard({ a, now, ws, onOpen }: { a: Atividade; now: number; ws: number; onOpen: (id: string) => void }) {
  const s = status(a, now), p = pct(a), e = expct(a, now);
  const today = Math.floor((now - ws) / 86400000);
  return (
    <button className={`card s-${s}`} onClick={() => onOpen(a.id)}>
      <div className="row">
        <div style={{ minWidth: 0 }}>
          <div className="t"><CritMark a={a} />{a.nome}</div>
          <div className="m">{a.frente} · {a.local}</div>
        </div>
        <Pill s={s} />
      </div>
      <div className="m">{a.equip}</div>
      <div className="prog" title="Marcador: previsto até agora">
        <i style={{ width: `${p}%` }} />
        {e > 0 && e < 100 && <b style={{ left: `${e}%` }} />}
      </div>
      <div className="nums num">
        <span><strong>{fmt(p)}%</strong> · {fq(a.real, a.un)} de {fq(a.meta, a.un)}</span>
        <span>prev. {fmt(e)}%</span>
      </div>
      <div className="mini">
        {Array.from({ length: 7 }, (_, d) => (
          <span key={d} className={`${ovl(addDays(ws, d), addDays(ws, d + 1), ms(a.ini), ms(a.fim)) > 0 ? "on" : ""} ${d === today ? "now" : ""}`} />
        ))}
      </div>
      {isBehind(s) && (
        <div className="motivo">
          <b>Motivo:</b> {a.motivo || <span className="bad">não informado</span>}{a.obs ? " · " + a.obs : ""}
        </div>
      )}
    </button>
  );
}

export function Kpi({ label, children, sub, bar }: { label: string; children: ReactNode; sub: ReactNode; bar?: [number, number] }) {
  return (
    <div className="kpi">
      <span className="eyebrow">{label}</span>
      <span className="v num">{children}</span>
      <span className="s num">{sub}</span>
      {bar && (
        <div className="bar">
          <i style={{ width: `${Math.min(100, bar[0])}%` }} />
          <b style={{ left: `${Math.min(100, bar[1])}%` }} />
        </div>
      )}
    </div>
  );
}
export const cls = (v: number, meta = 85) => (v >= Math.max(90, meta) ? "good" : v >= meta - 5 ? "warn" : "bad");

export const Icon = {
  warn: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.5" strokeLinecap="round" /></svg>,
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" strokeLinecap="round" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>,
  down: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3" /></svg>,
  up: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15V3m0 0L8 7m4-4l4 4M4 17v3h16v-3" /></svg>,
  more: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>,
  gear: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></svg>,
  share: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
};
