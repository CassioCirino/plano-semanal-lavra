import { useEffect, useState } from "react";
import type { Atividade, Config, Status } from "./lib/types";
import { FRENTES, ST_LABEL } from "./lib/types";
import {
  alerts, daily, expct, fmt, fq, history, indicators, isBehind, isMass, monthStats, pct, planToNow, status, stepOf,
} from "./lib/calc";
import { DIAS, DIAS_FULL, HOUR, MESES_FULL, WEEK_H, addDays, fmtDH, fmtHM, isoWeek, ms, ovl, weekStart } from "./lib/time";
import { ActCard, CritMark, Icon, Kpi, Pill, cls } from "./ui";

export interface VProps {
  all: Atividade[];
  week: Atividade[]; // atividades que começam na semana
  range: Atividade[]; // atividades que aparecem na semana
  ws: number;
  now: number;
  cfg: Config;
  onOpen: (id: string) => void;
  upsert: (a: Atividade) => void;
  toast: (m: string) => void;
}

const useIsMobile = () => {
  const q = "(max-width:860px)";
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mm = matchMedia(q);
    const h = () => setM(mm.matches);
    mm.addEventListener("change", h);
    return () => mm.removeEventListener("change", h);
  }, []);
  return m;
};
const refNow = (ws: number, now: number) => Math.min(now, addDays(ws, 7));

export function KpiStrip({ week, ws, now, cfg }: Pick<VProps, "week" | "ws" | "now" | "cfg">) {
  const t = refNow(ws, now);
  const I = indicators(week, t);
  const late = week.filter((a) => status(a, t) === "late").length;
  const crit = week.filter((a) => status(a, t) === "crit").length;
  return (
    <div className="kpis">
      <Kpi label="Aderência · movimentação" sub="ROM e estéril realizados dentro do planejado até agora">
        {I.hasMass ? <span className={cls(I.aderMov, cfg.metaAderencia)}>{fmt(I.aderMov)}<small>%</small></span> : <span className="muted">—</span>}
      </Kpi>
      <Kpi label="Aderência · geometria" sub="Perfuração, desmonte, acessos e bermas">
        {I.hasGeo ? <span className={cls(I.aderGeo, cfg.metaAderencia)}>{fmt(I.aderGeo)}<small>%</small></span> : <span className="muted">—</span>}
      </Kpi>
      <Kpi label="Movimentação da semana" sub={<>de {fmt(I.weekPlan / 1000, 1)} kt no plano · cumprimento {fmt(I.cumpr)}% até agora</>}
        bar={I.weekPlan ? [(I.weekReal / I.weekPlan) * 100, (I.planNow / I.weekPlan) * 100] : undefined}>
        {fmt(I.weekReal / 1000, 1)}<small>kt</small>
      </Kpi>
      <Kpi label="Atenção" sub={`de ${week.length} atividades na semana`}>
        <span className="bad">{crit}</span><small>críticas</small>{" "}
        <span className="warn" style={{ marginLeft: 6 }}>{late}</span><small>atrasadas</small>
      </Kpi>
    </div>
  );
}

const ORDER: Record<Status, number> = { crit: 0, late: 1, ok: 2, ahead: 3, prog: 4, done: 5 };

export function GanttView(p: VProps) {
  const isM = useIsMobile();
  const [modePref, setModePref] = useState<string | null>(() => { try { return localStorage.getItem("psl.modo"); } catch { return null; } });
  const mode = modePref ?? (isM ? "dia" : "gantt");
  const setMode = (m: string) => { setModePref(m); try { localStorage.setItem("psl.modo", m); } catch { /* */ } };
  const [filtro, setFiltro] = useState("Todas");
  const [soAtencao, setSoAtencao] = useState(false);
  const curWeek = weekStart(p.now) === p.ws;
  const todayIdx = curWeek ? Math.floor((p.now - p.ws) / (24 * HOUR)) : -1;
  const [day, setDay] = useState(Math.max(0, todayIdx));
  useEffect(() => setDay(Math.max(0, todayIdx)), [p.ws]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = refNow(p.ws, p.now);
  const frentes = [...FRENTES, ...new Set(p.range.map((a) => a.frente).filter((f) => !FRENTES.includes(f)))];
  const list = p.range.filter((a) => (filtro === "Todas" || a.frente === filtro) && (!soAtencao || isBehind(status(a, t))));
  const nowL = ((p.now - p.ws) / HOUR / WEEK_H) * 100;
  const showNow = nowL > 0 && nowL < 100;
  const pos = (iso: string) => Math.max(0, Math.min(WEEK_H, (ms(iso) - p.ws) / HOUR)) / WEEK_H * 100;

  return (
    <section className="view">
      <KpiStrip week={p.week} ws={p.ws} now={p.now} cfg={p.cfg} />
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Modo de visualização">
          <button aria-pressed={mode === "gantt"} onClick={() => setMode("gantt")}>Linha do tempo</button>
          <button aria-pressed={mode === "dia"} onClick={() => setMode("dia")}>Por dia</button>
        </div>
        {["Todas", ...frentes].map((g) => (
          <button key={g} className="chip" aria-pressed={filtro === g} onClick={() => setFiltro(g)}>{g}</button>
        ))}
        <button className="chip" aria-pressed={soAtencao} onClick={() => setSoAtencao(!soAtencao)}>Só atrasos e críticas</button>
      </div>
      <div className="legend">
        {(["ok", "ahead", "late", "crit", "done", "prog"] as Status[]).map((s) => (
          <span key={s}><i className={`dot s-${s}`} style={{ background: "var(--c)" }} />{ST_LABEL[s]}</span>
        ))}
        <span><span className="crit-mark" style={{ margin: 0 }}>◆</span>Atividade crítica</span>
        {showNow && <span><i className="dot" style={{ background: "var(--accent)", width: 2, height: 12, borderRadius: 0 }} />Agora ({fmtHM(p.now)})</span>}
      </div>

      {mode === "gantt" ? (
        <>
          <div className="panel"><div className="gwrap"><div className="gantt">
            <div className="g-head">
              <div className="g-corner">Atividade · equipamento</div>
              <div className="g-days">
                {DIAS.map((d, i) => (
                  <div key={d} className={i === todayIdx ? "today" : ""}><b>{new Date(addDays(p.ws, i)).getDate()}</b>{d}</div>
                ))}
                {showNow && <span className="g-now" style={{ left: `${nowL}%` }} />}
              </div>
            </div>
            {frentes.map((g) => {
              const gs = list.filter((a) => a.frente === g).sort((a, b) => ms(a.ini) - ms(b.ini));
              if (!gs.length) return null;
              return [
                <div key={g} className="g-group"><span>{g}</span></div>,
                ...gs.flatMap((a) => {
                  const s = status(a, t), L = pos(a.ini), end = pos(a.fim), W = Math.max(0.6, end - L), pp = pct(a);
                  const valStyle = end > 80
                    ? { right: `calc(${100 - end}% + 8px)`, background: "var(--surface)", padding: "0 5px", borderRadius: 4 }
                    : { left: `calc(${end}% + 6px)` };
                  const rs = a.iniReal ? pos(a.iniReal) : null;
                  const re = a.fimReal ? pos(a.fimReal) : a.iniReal ? pos(new Date(Math.min(p.now, addDays(p.ws, 7))).toISOString()) : null;
                  return [
                    <div key={a.id + "l"} className="g-label" onClick={() => p.onOpen(a.id)}>
                      <div className="t"><CritMark a={a} />{a.nome}</div>
                      <div className="m">{a.local} · {a.equip}</div>
                    </div>,
                    <div key={a.id + "t"} className={`g-track s-${s}`}>
                      <button className={`g-bar s-${s}`} onClick={() => p.onOpen(a.id)} style={{ left: `${L}%`, width: `${W}%` }}
                        aria-label={`${a.nome}, ${ST_LABEL[s]}, ${fmt(pp)}%`}><i style={{ width: `${pp}%` }} /></button>
                      <span className={`g-val num s-${s}`} style={valStyle}><b>{fmt(pp)}%</b> · {fq(a.real, a.un)}/{fq(a.meta, a.un)}</span>
                      {rs !== null && re !== null && re > rs && <span className="g-real" title="Execução real" style={{ left: `${rs}%`, width: `${re - rs}%` }} />}
                      {showNow && <span className="g-now" style={{ left: `${nowL}%` }} />}
                    </div>,
                  ];
                }),
              ];
            })}
            {!list.length && <div className="g-group" style={{ textAlign: "center", textTransform: "none", letterSpacing: 0 }}>Nenhuma atividade nesta semana com esse filtro.</div>}
          </div></div></div>
          <div className="muted" style={{ fontSize: 12 }}>Barra = período planejado; preenchimento = % realizado; traço fino abaixo = execução real. Toque numa atividade para apontar o andamento.</div>
        </>
      ) : (
        <>
          <div className="daystrip" role="group" aria-label="Dia">
            {DIAS.map((x, i) => {
              const d0 = addDays(p.ws, i), d1 = addDays(p.ws, i + 1);
              const bad = (curWeek ? i <= todayIdx : d0 < p.now) && p.range.some((a) => ovl(d0, d1, ms(a.ini), ms(a.fim)) > 0 && isBehind(status(a, t)));
              return (
                <button key={x} aria-pressed={i === day} className={i === todayIdx ? "today" : ""} onClick={() => setDay(i)}>
                  {x}<b>{new Date(d0).getDate()}</b><i className={bad ? "on" : ""} />
                </button>
              );
            })}
          </div>
          {(() => {
            const d0 = addDays(p.ws, day), d1 = addDays(p.ws, day + 1);
            const dayActs = list.filter((a) => ovl(d0, d1, ms(a.ini), ms(a.fim)) > 0)
              .sort((a, b) => ORDER[status(a, t)] - ORDER[status(b, t)] || ms(a.ini) - ms(b.ini));
            const dt = new Date(d0);
            return (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <h3>{DIAS_FULL[day]}, {dt.getDate()} de {MESES_FULL[dt.getMonth()]}{day === todayIdx ? " · hoje" : ""}</h3>
                  <span className="muted num" style={{ fontSize: 12 }}>{dayActs.length} atividades</span>
                </div>
                <div className="cards">
                  {dayActs.map((a) => <ActCard key={a.id} a={a} now={t} ws={p.ws} onOpen={p.onOpen} />)}
                  {!dayActs.length && <div className="muted">Nenhuma atividade neste dia com esse filtro.</div>}
                </div>
              </>
            );
          })()}
        </>
      )}
    </section>
  );
}

export function HojeView(p: VProps) {
  const now = p.now, wsNow = weekStart(now);
  const curWeek = p.all.filter((a) => { const i = ms(a.ini); return i >= wsNow && i < addDays(wsNow, 7); });
  const running = p.all.filter((a) => ms(a.ini) <= now && now < ms(a.fim) && status(a, now) !== "done")
    .sort((a, b) => (pct(a) - expct(a, now)) - (pct(b) - expct(b, now)));
  const next = p.all.filter((a) => ms(a.ini) > now && ms(a.ini) <= now + 24 * HOUR).sort((a, b) => ms(a.ini) - ms(b.ini));
  const due = p.all.filter((a) => ms(a.fim) > now && ms(a.fim) <= now + 24 * HOUR && status(a, now) !== "done");
  const M = monthStats(p.all, now, p.cfg);
  const al = alerts(curWeek, wsNow, now, p.cfg, M);
  const di = Math.floor((now - wsNow) / (24 * HOUR));
  const dd = daily(p.all.filter((a) => ovl(ms(a.ini), ms(a.fim), wsNow, addDays(wsNow, 7)) > 0), wsNow, now)[di];
  const h = new Date(now).getHours();
  const turno = h >= 7 && h < 19 ? "Turno A (07h às 19h)" : "Turno B (19h às 07h)";
  const dt = new Date(now);
  return (
    <section className="view">
      <div className="nowcard">
        <div className="clock num">{fmtHM(now)}</div>
        <div className="meta">
          <strong>{DIAS_FULL[(dt.getDay() + 6) % 7]}, {dt.getDate()} de {MESES_FULL[dt.getMonth()]}</strong>
          <span>{turno} · Semana {isoWeek(now).week}</span>
        </div>
        <div className="counts num">
          <div><b>{running.length}</b><span>rodando agora</span></div>
          <div><b>{fmt(dd.romR / 1000, 1)} kt</b><span>ROM hoje · plano {fmt(dd.romP / 1000, 1)}</span></div>
          <div><b>{fmt(dd.estR / 1000, 1)} kt</b><span>estéril hoje · plano {fmt(dd.estP / 1000, 1)}</span></div>
        </div>
      </div>
      <div className="cols">
        <div className="stack">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3>Deveria estar rodando agora</h3><span className="muted" style={{ fontSize: 12 }}>piores desvios primeiro</span>
          </div>
          <div className="cards">
            {running.map((a) => <ActCard key={a.id} a={a} now={now} ws={weekStart(ms(a.ini)) === wsNow ? wsNow : wsNow} onOpen={p.onOpen} />)}
            {!running.length && <div className="muted">Nenhuma atividade programada para este momento.</div>}
          </div>
        </div>
        <div className="stack">
          <h3>Precisa de reação</h3>
          {al.map((x, i) => (
            <div key={i} className={`alert s-${x.kind === "info" ? "ahead" : x.kind}`} style={x.id ? { cursor: "pointer" } : undefined}
              onClick={x.id ? () => p.onOpen(x.id!) : undefined}>
              {x.kind === "info" ? Icon.info : Icon.warn}
              <div><div className="t">{x.title}</div><div className="d">{x.detail}</div></div>
            </div>
          ))}
          {!al.length && <div className="okbox">Nenhum atraso ou alerta de capacidade agora.</div>}
          <div className="panel"><div className="panel-h"><h3>Próximas 24 horas</h3></div><div className="panel-b">
            {next.map((a) => (
              <div key={a.id} className="list-row" style={{ cursor: "pointer" }} onClick={() => p.onOpen(a.id)}>
                <span><CritMark a={a} /><strong style={{ fontWeight: 600 }}>{a.nome}</strong><br /><span className="muted" style={{ fontSize: 12 }}>{a.local} · {a.equip}</span></span>
                <span className="mono muted" style={{ whiteSpace: "nowrap" }}>início {fmtDH(ms(a.ini)).slice(0, 3)} {fmtHM(ms(a.ini))}</span>
              </div>
            ))}
            {due.map((a) => (
              <div key={a.id} className="list-row" style={{ cursor: "pointer" }} onClick={() => p.onOpen(a.id)}>
                <span><strong style={{ fontWeight: 600 }}>{a.nome}</strong><br /><span className="muted" style={{ fontSize: 12 }}>{a.local} · {fmt(pct(a))}% feito</span></span>
                <span className="mono muted" style={{ whiteSpace: "nowrap" }}>termina {fmtDH(ms(a.fim)).slice(0, 3)} {fmtHM(ms(a.fim))}</span>
              </div>
            ))}
            {!next.length && !due.length && <div className="muted">Nada começa ou termina nas próximas 24 h.</div>}
          </div></div>
        </div>
      </div>
    </section>
  );
}

export function ApontarView(p: VProps) {
  const now = p.now;
  const list = p.all.filter((a) => ms(a.ini) <= now && status(a, now) !== "done" && ms(a.fim) >= now - 7 * 24 * HOUR)
    .sort((a, b) => ms(a.ini) - ms(b.ini));
  const done = p.all.filter((a) => status(a, now) === "done" && ms(a.fim) >= now - 3 * 24 * HOUR && ms(a.ini) <= now)
    .sort((a, b) => ms(b.fimReal ?? b.fim) - ms(a.fimReal ?? a.fim));
  const bump = (a: Atividade, v: number) => {
    const real = Math.round(Math.max(0, Math.min(a.meta, a.real + v)) * 10) / 10;
    const n: Atividade = { ...a, real };
    if (real > 0 && !n.iniReal) n.iniReal = new Date(Math.max(ms(a.ini), now - HOUR)).toISOString();
    if (real >= a.meta && !n.fimReal) n.fimReal = new Date(now).toISOString();
    if (real < a.meta) n.fimReal = null;
    p.upsert(n);
    const s = status(n, now);
    p.toast(`${a.nome}: ${fq(real, a.un)} · ${ST_LABEL[s]}${isBehind(s) && !n.motivo ? " · informe o motivo" : ""}`);
  };
  const concluir = (a: Atividade) => {
    p.upsert({ ...a, real: a.meta, fimReal: new Date(now).toISOString(), iniReal: a.iniReal ?? a.ini });
    p.toast(`${a.nome} concluída`);
  };
  const dec = (a: Atividade) => (a.un === "km" ? 1 : 0);
  return (
    <section className="view">
      <div>
        <div className="eyebrow">Apontamento rápido</div>
        <h2>Atualize o andamento em um toque</h2>
        <p className="muted" style={{ margin: "4px 0 0", maxWidth: "62ch" }}>Use os botões para somar o realizado do turno. Toque no nome para ajustar %, datas reais e motivo do desvio. Os indicadores se recalculam na hora para toda a equipe.</p>
      </div>
      <div className="panel"><div className="panel-b stack" style={{ gap: 0 }}>
        {list.map((a) => {
          const st = stepOf(a), s = status(a, now), e = expct(a, now);
          return (
            <div key={a.id} className={`ap s-${s}`} style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
              <div style={{ minWidth: 0, cursor: "pointer" }} onClick={() => p.onOpen(a.id)}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong><CritMark a={a} />{a.nome}</strong><Pill s={s} /></div>
                <div className="muted" style={{ fontSize: 12 }}>{a.frente} · {a.local} · {a.equip}</div>
                <div className="prog" style={{ marginTop: 8 }}><i style={{ width: `${pct(a)}%` }} />{e < 100 && <b style={{ left: `${e}%` }} />}</div>
                <div className="muted num" style={{ fontSize: 12, marginTop: 4 }}><strong style={{ color: "var(--fg)" }}>{fq(a.real, a.un)}</strong> de {fq(a.meta, a.un)} · {fmt(pct(a))}% (previsto {fmt(e)}%)</div>
              </div>
              <div className="ap-actions">
                <button className="qbtn" onClick={() => bump(a, -st)} aria-label="Diminuir">−{a.un === "fogo" ? "" : fmt(st, dec(a))}</button>
                <button className="qbtn" onClick={() => bump(a, st)}>+{a.un === "fogo" ? "1 fogo" : `${fmt(st, dec(a))} ${a.un}`}</button>
                {a.un !== "fogo" && <button className="qbtn" onClick={() => bump(a, st * 4)}>+{fmt(st * 4, dec(a))}</button>}
                <button className="qbtn ok" onClick={() => concluir(a)}>Concluir</button>
              </div>
            </div>
          );
        })}
        {!list.length && <div className="muted" style={{ padding: "8px 0" }}>Nenhuma atividade em andamento para apontar agora.</div>}
      </div></div>
      {done.length > 0 && (
        <div className="panel"><div className="panel-h"><h3>Concluídas recentemente</h3></div><div className="panel-b">
          {done.map((a) => (
            <div key={a.id} className="list-row" style={{ cursor: "pointer" }} onClick={() => p.onOpen(a.id)}>
              <span>{a.nome} · <span className="muted">{a.local}</span></span>
              <span className="mono muted">{a.fimReal ? "fim " + fmtDH(ms(a.fimReal)) : ""}</span>
            </div>
          ))}
        </div></div>
      )}
    </section>
  );
}

function ChartDaily({ week, ws, now }: { week: Atividade[]; ws: number; now: number }) {
  const [w, setW] = useState(() => Math.min(1400, window.innerWidth));
  useEffect(() => { const h = () => setW(Math.min(1400, window.innerWidth)); addEventListener("resize", h); return () => removeEventListener("resize", h); }, []);
  const D = daily(week, ws, now);
  const W = Math.max(520, w - 100), Hh = Math.round(Math.min(300, Math.max(220, W * 0.3)));
  const pl = 44, pb = 28, pt = 16, pr = 8;
  const top = Math.max(5000, ...D.map((o) => o.romP + o.estP), ...D.map((o) => o.romR + o.estR));
  const stepV = top > 40000 ? 10000 : 5000;
  const max = Math.ceil(top / stepV) * stepV;
  const y = (v: number) => pt + (Hh - pt - pb) * (1 - v / max), bw = (W - pl - pr) / 7;
  const todayIdx = Math.floor((now - ws) / (24 * HOUR));
  const ticks: number[] = []; for (let v = 0; v <= max; v += stepV) ticks.push(v);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label="Movimentação planejada e realizada por dia">
      {ticks.map((v) => (
        <g key={v}><line className="grid" x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} /><text x={pl - 6} y={y(v) + 4} textAnchor="end">{v / 1000}k</text></g>
      ))}
      {D.map((o, i) => {
        const x = pl + i * bw, bwi = bw * 0.32, x0 = x + bw * 0.14, x1 = x0 + bwi + 3;
        const past = addDays(ws, i) < now;
        return (
          <g key={i}>
            <rect x={x0} y={y(o.romP)} width={bwi} height={y(0) - y(o.romP)} fill="var(--rom)" fillOpacity=".22" stroke="var(--rom)" />
            <rect x={x0} y={y(o.romP + o.estP)} width={bwi} height={y(o.romP) - y(o.romP + o.estP)} fill="var(--est)" fillOpacity=".22" stroke="var(--est)" />
            {past && <>
              <rect x={x1} y={y(o.romR)} width={bwi} height={y(0) - y(o.romR)} fill="var(--rom)" />
              <rect x={x1} y={y(o.romR + o.estR)} width={bwi} height={y(o.romR) - y(o.romR + o.estR)} fill="var(--est)" />
              <text x={x1 + bwi / 2} y={y(o.romR + o.estR) - 5} textAnchor="middle" style={{ fill: "var(--fg)", fontWeight: 600 }}>{fmt((o.romR + o.estR) / 1000, 1)}</text>
            </>}
            <text x={x + bw / 2} y={Hh - 8} textAnchor="middle" style={i === todayIdx ? { fill: "var(--accent)", fontWeight: 600 } : undefined}>
              {DIAS[i]} {new Date(addDays(ws, i)).getDate()}{i === todayIdx ? " (parcial)" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ChartHist({ all, now, meta, ws }: { all: Atividade[]; now: number; meta: number; ws: number }) {
  const H = history(all, now, 9);
  const W = 420, Hh = 190, pl = 30, pb = 24, pt = 18, pr = 8;
  const vals = H.map((h) => h.ader).filter((v): v is number => v !== null);
  const lo = Math.max(0, Math.floor(Math.min(60, ...vals, meta) / 10) * 10);
  const hi = Math.max(100, Math.ceil(Math.max(...vals, 0) / 10) * 10);
  const y = (v: number) => pt + (Hh - pt - pb) * (1 - (v - lo) / (hi - lo)), bw = (W - pl - pr) / H.length;
  const ticks: number[] = []; for (let v = lo; v <= hi; v += 10) ticks.push(v);
  return (
    <svg className="chart h" viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label="Aderência das últimas semanas">
      {ticks.map((v) => <g key={v}><line className="grid" x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} /><text x={pl - 5} y={y(v) + 4} textAnchor="end">{v}</text></g>)}
      <line x1={pl} x2={W - pr} y1={y(meta)} y2={y(meta)} stroke="var(--ok)" strokeDasharray="4 3" strokeWidth="1.5" />
      {H.map((h, i) => {
        const x = pl + i * bw + bw * 0.2, sel = h.ws === ws;
        return (
          <g key={h.ws}>
            {h.ader !== null && <rect x={x} y={y(h.ader)} width={bw * 0.6} height={y(lo) - y(h.ader)} rx="3" fill="var(--accent)" fillOpacity={sel ? 1 : 0.35} />}
            {h.ader !== null && sel && <text x={x + bw * 0.3} y={y(h.ader) - 5} textAnchor="middle" style={{ fill: "var(--fg)", fontWeight: 600 }}>{fmt(h.ader)}%</text>}
            <text x={x + bw * 0.3} y={Hh - 8} textAnchor="middle">S{isoWeek(h.ws).week}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function AderenciaView(p: VProps) {
  const t = refNow(p.ws, p.now);
  const I = indicators(p.week, t), meta = p.cfg.metaAderencia;
  const M = monthStats(p.all, p.now, p.cfg), f = M.frac;
  const mov = M.rom + M.est;
  const c = (v: number) => cls(v, meta);
  const meter = (lbl: string, ac: number, mt: number, color: string, sub: string) => (
    <div className="meter">
      <div className="row"><strong>{lbl}</strong><span className="num">{fmt(ac / 1000)} / {fmt(mt / 1000)} kt · <span className={c(mt ? (ac / (mt * f)) * 100 : 100)}>{mt ? fmt((ac / (mt * f)) * 100) : "—"}% do previsto</span></span></div>
      <div className="track"><i style={{ width: `${mt ? Math.min(100, (ac / mt) * 100) : 0}%`, background: color }} /><b style={{ left: `${f * 100}%` }} title="Previsto até hoje" /></div>
      <div className="sub">{sub}</div>
    </div>
  );
  const mmax = M.motivos[0]?.[1] ?? 1;
  const rows = p.week.filter((a) => expct(a, t) > 0 || a.real > 0).sort((a, b) => ms(a.ini) - ms(b.ini));
  const mes = MESES_FULL[new Date(p.now).getMonth()];
  const pdePct = p.cfg.pdeCap ? (M.pdeOcupAtual / p.cfg.pdeCap) * 100 : 0;
  return (
    <section className="view">
      <div>
        <div className="eyebrow">Semana {isoWeek(p.ws).week}{t < addDays(p.ws, 7) ? ` até ${fmtDH(t)}` : " (fechada)"} · {mes} até hoje</div>
        <h2>Aderência e cumprimento do plano</h2>
      </div>
      <div className="kpis">
        <Kpi label="Aderência · movimentação" sub="Σ mín(realizado, planejado) ÷ Σ planejado até agora">
          {I.hasMass ? <span className={c(I.aderMov)}>{fmt(I.aderMov)}<small>%</small></span> : <span className="muted">—</span>}
        </Kpi>
        <Kpi label="Aderência · geometria" sub="Avanço físico nas frentes programadas">
          {I.hasGeo ? <span className={c(I.aderGeo)}>{fmt(I.aderGeo)}<small>%</small></span> : <span className="muted">—</span>}
        </Kpi>
        <Kpi label="Cumprimento" sub="Σ realizado ÷ Σ planejado até agora (pode passar de 100%)">
          {I.hasMass ? <span className={c(I.cumpr)}>{fmt(I.cumpr)}<small>%</small></span> : <span className="muted">—</span>}
        </Kpi>
        <Kpi label={`Movimentação em ${mes}`} sub={<>capacidade {fmt(M.capMov / 1e6, 2)} Mt · {fmt(M.capMov ? (mov / M.capMov) * 100 : 0)}% usada</>}
          bar={[M.capMov ? (mov / M.capMov) * 100 : 0, f * 100]}>
          {fmt(mov / 1e6, 2)}<small>Mt</small>
        </Kpi>
      </div>
      <div className="panel">
        <div className="panel-h"><h3>Planejado x realizado por dia</h3>
          <div className="legend"><span><i className="dot" style={{ background: "var(--rom)" }} />ROM → UTM</span><span><i className="dot" style={{ background: "var(--est)" }} />Estéril → {p.cfg.pdeNome}</span><span><i className="dot" style={{ border: "1px solid var(--muted)" }} />Planejado (claro)</span></div>
        </div>
        <div className="panel-b"><div className="gwrap"><ChartDaily week={p.range.filter(isMass)} ws={p.ws} now={p.now} /></div></div>
      </div>
      <div className="grid2">
        <div className="panel"><div className="panel-h"><h3>Mês x orçamento</h3><span className="muted" style={{ fontSize: 12 }}>traço = previsto até hoje</span></div><div className="panel-b">
          {meter("ROM para a UTM", M.rom, M.romMeta, "var(--rom)", `Orçamento de ${mes}: ${fmt(M.romMeta / 1000)} kt · capacidade da UTM ${fmt(p.cfg.capUTM / 1000, 1)} kt/dia`)}
          {meter(`Estéril para a ${p.cfg.pdeNome}`, M.est, M.estMeta, "var(--est)", `Orçamento de ${mes}: ${fmt(M.estMeta / 1000)} kt`)}
          <div className="meter">
            <div className="row"><strong>Ocupação da {p.cfg.pdeNome}</strong><span className="num">{fmt(M.pdeOcupAtual / 1e6, 2)} / {fmt(p.cfg.pdeCap / 1e6, 2)} Mt</span></div>
            <div className="track"><i style={{ width: `${Math.min(100, pdePct)}%`, background: pdePct >= 90 ? "var(--crit)" : "var(--late)" }} /></div>
            <div className="sub">{fmt(pdePct)}% da capacidade licenciada</div>
          </div>
        </div></div>
        <div className="panel"><div className="panel-h"><h3>Aderência por semana</h3><span className="muted" style={{ fontSize: 12 }}>movimentação, % · <span className="good">tracejado = meta {meta}%</span></span></div>
          <div className="panel-b"><ChartHist all={p.all} now={p.now} meta={meta} ws={p.ws} /></div></div>
      </div>
      <div className="panel"><div className="panel-h"><h3>Por atividade</h3><span className="muted" style={{ fontSize: 12 }}>até agora · toque para apontar</span></div>
        <div className="panel-b"><div className="gwrap"><table className="tbl">
          <thead><tr><th>Atividade</th><th className="r">Plan. até agora</th><th className="r">Realizado</th><th className="r">Aderência</th><th className="r">Desvio</th><th>Status</th><th>Motivo</th></tr></thead>
          <tbody>
            {rows.map((a) => {
              const pn = isMass(a) ? planToNow(a, t) : (a.meta * expct(a, t)) / 100;
              const ad = pn > 0 ? (Math.min(a.real, pn) / pn) * 100 : 100;
              const d = pct(a) - expct(a, t);
              return (
                <tr key={a.id} onClick={() => p.onOpen(a.id)}>
                  <td><CritMark a={a} /><strong style={{ fontWeight: 600 }}>{a.nome}</strong><br /><span className="muted" style={{ fontSize: 12 }}>{a.frente} · {a.local}</span></td>
                  <td className="r num">{fq(a.un === "t" ? Math.round(pn) : Math.round(pn * 10) / 10, a.un)}</td>
                  <td className="r num">{fq(a.real, a.un)}</td>
                  <td className={`r num ${c(ad)}`}>{fmt(ad)}%</td>
                  <td className={`r num ${d < -5 ? "bad" : d > 5 ? "good" : ""}`}>{d > 0 ? "+" : ""}{fmt(d)} p.p.</td>
                  <td><Pill s={status(a, t)} /></td>
                  <td className="muted">{a.motivo || "—"}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={7} className="muted">Nenhuma atividade iniciada nesta semana.</td></tr>}
          </tbody>
        </table></div></div>
      </div>
      <div className="panel"><div className="panel-h"><h3>Motivos de desvio em {mes}</h3><span className="muted" style={{ fontSize: 12 }}>horas perdidas estimadas</span></div><div className="panel-b">
        {M.motivos.map(([k, v]) => (
          <div key={k} className="hbar"><span>{k}</span><div className="tr"><i style={{ width: `${(v / mmax) * 100}%` }} /></div><span className="num muted" style={{ textAlign: "right" }}>{v} h</span></div>
        ))}
        {!M.motivos.length && <div className="muted">Nenhum desvio com motivo informado neste mês.</div>}
      </div></div>
    </section>
  );
}
