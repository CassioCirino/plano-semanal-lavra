import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Atividade } from "./lib/types";
import { DIAS, MESES_FULL, addDays, isoWeek, ms, weekStart } from "./lib/time";

/** Calendário para escolher a semana: navega por mês/ano, toca numa linha (semana) e pronto. */
export function PeriodPicker({ ws, now, acts, onPick, onClose }: {
  ws: number; now: number; acts: Atividade[]; onPick: (ws: number) => void; onClose: () => void;
}) {
  const sel = new Date(addDays(ws, 3));
  const [ym, setYm] = useState({ y: sel.getFullYear(), m: sel.getMonth() });
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  const first = new Date(ym.y, ym.m, 1).getTime();
  const last = new Date(ym.y, ym.m + 1, 0).getTime();
  const weeks: number[] = [];
  for (let w = weekStart(first); w <= last; w = addDays(w, 7)) weeks.push(w);
  const cur = weekStart(now);
  const count = (w: number) => { const e = addDays(w, 7); return acts.filter((a) => { const i = ms(a.ini); return i >= w && i < e; }).length; };
  // meses com dados, para pular direto
  const months = [...new Set(acts.map((a) => { const d = new Date(a.ini); return d.getFullYear() * 12 + d.getMonth(); }))].sort((a, b) => a - b);
  const move = (n: number) => setYm(({ y, m }) => { const t = y * 12 + m + n; return { y: Math.floor(t / 12), m: t % 12 }; });
  const pick = (w: number) => { onPick(w); onClose(); };
  const years = Array.from({ length: 6 }, (_, i) => new Date(now).getFullYear() - 3 + i);
  return createPortal(
    <>
      <div className="pk-scrim" onClick={onClose} />
      <div className="picker" role="dialog" aria-label="Escolher período">
        <div className="pk-quick">
          <button className="chip" onClick={() => pick(addDays(cur, -7))}>Semana passada</button>
          <button className="chip" aria-pressed={ws === cur} onClick={() => pick(cur)}>Esta semana</button>
          <button className="chip" onClick={() => pick(addDays(cur, 7))}>Próxima semana</button>
        </div>
        <div className="pk-head">
          <button className="iconbtn" onClick={() => move(-1)} aria-label="Mês anterior">‹</button>
          <div className="pk-title">
            <select className="inp" aria-label="Mês" value={ym.m} onChange={(e) => setYm({ ...ym, m: +e.target.value })}>
              {MESES_FULL.map((n, i) => <option key={n} value={i}>{n[0].toUpperCase() + n.slice(1)}</option>)}
            </select>
            <select className="inp" aria-label="Ano" value={ym.y} onChange={(e) => setYm({ ...ym, y: +e.target.value })}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </div>
          <button className="iconbtn" onClick={() => move(1)} aria-label="Próximo mês">›</button>
        </div>
        <div className="pk-grid">
          <span className="pk-wk">Sem.</span>
          {DIAS.map((d) => <span key={d} className="pk-dow">{d[0]}</span>)}
          <span />
          {weeks.map((w) => {
            const n = count(w);
            return (
              <button key={w} className={`pk-row ${w === ws ? "sel" : ""} ${w === cur ? "cur" : ""}`} onClick={() => pick(w)}
                aria-label={`Semana ${isoWeek(w).week}, ${n} atividades`}>
                <span className="pk-wk">S{isoWeek(w).week}</span>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(addDays(w, i));
                  return <span key={i} className={`pk-d ${d.getMonth() !== ym.m ? "out" : ""} ${d.toDateString() === new Date(now).toDateString() ? "today" : ""}`}>{d.getDate()}</span>;
                })}
                <span className={`pk-n ${n ? "on" : ""}`}>{n || ""}</span>
              </button>
            );
          })}
        </div>
        {months.length > 0 && (
          <div className="pk-months">
            <span className="muted">Meses com dados:</span>
            {months.map((t) => {
              const y = Math.floor(t / 12), m = t % 12;
              return <button key={t} className="chip" aria-pressed={y === ym.y && m === ym.m} onClick={() => setYm({ y, m })}>{MESES_FULL[m].slice(0, 3)}/{String(y).slice(2)}</button>;
            })}
          </div>
        )}
        <div className="muted" style={{ fontSize: 12 }}>Toque numa linha para abrir a semana. O número à direita é a quantidade de atividades.</div>
      </div>
    </>,
    document.body,
  );
}
