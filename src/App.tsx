import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Atividade } from "./lib/types";
import { useStore, type Sync } from "./lib/store";
import { inWeekRange, ofWeek } from "./lib/calc";
import { addDays, weekLabel, weekStart } from "./lib/time";
import { exportModelo, exportPlano } from "./lib/excel";
import { sampleHistory, sampleMonth, sampleWeek } from "./lib/sample";
import { AderenciaView, ApontarView, GanttView, HojeView, type VProps } from "./views";
import { ActivityForm, ImportSheet, SettingsSheet, UpdateSheet } from "./sheets";
import { Icon } from "./ui";
import { PeriodPicker } from "./picker";

type View = "gantt" | "hoje" | "apontar" | "aderencia";
const VIEWS: View[] = ["gantt", "hoje", "apontar", "aderencia"];
const LABEL: Record<View, string> = { gantt: "Gantt", hoje: "Hoje", apontar: "Apontar", aderencia: "Aderência" };
const readHash = (): View => { const h = location.hash.slice(1) as View; return VIEWS.includes(h) ? h : "gantt"; };

type SheetState =
  | { k: "update"; id: string }
  | { k: "form"; id: string | null }
  | { k: "settings" }
  | { k: "import" }
  | null;

const SYNC_TXT: Record<Sync, string> = { local: "Neste aparelho", sincronizado: "Sincronizado", enviando: "Sincronizando…", offline: "Sem sinal · salvo no aparelho", erro: "Erro ao sincronizar" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BIP = any;

export default function App() {
  const store = useStore();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const [ws, setWs] = useState(() => weekStart(Date.now()));
  const [view, setView] = useState<View>(readHash);
  useEffect(() => { const h = () => { setView(readHash()); window.scrollTo(0, 0); }; addEventListener("hashchange", h); return () => removeEventListener("hashchange", h); }, []);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [menu, setMenu] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const tt = useRef<number>();
  const toast = useCallback((m: string) => { setMsg(m); clearTimeout(tt.current); tt.current = window.setTimeout(() => setMsg(null), 2800); }, []);
  const [bip, setBip] = useState<BIP>(null);
  useEffect(() => { const h = (e: Event) => { e.preventDefault(); setBip(e); }; addEventListener("beforeinstallprompt", h); return () => removeEventListener("beforeinstallprompt", h); }, []);
  const [picker, setPicker] = useState(false);

  const week = useMemo(() => ofWeek(store.acts, ws), [store.acts, ws]);
  const range = useMemo(() => inWeekRange(store.acts, ws), [store.acts, ws]);
  const { week: wn, range: wr } = weekLabel(ws);
  const curWs = weekStart(now);

  const vp: VProps = { all: store.acts, week, range, ws, now, cfg: store.cfg, onOpen: (id) => setSheet({ k: "update", id }), upsert: store.upsert, toast };
  const sel = sheet && (sheet.k === "update" || sheet.k === "form") && sheet.id ? store.acts.find((a) => a.id === sheet.id) ?? null : null;

  const loadSample = () => {
    store.upsertMany([...sampleHistory(now), ...sampleWeek(now)]);
    setWs(curWs);
    toast("Dados de exemplo carregados");
  };
  const loadJan = () => {
    const list = sampleMonth(2026, 0);
    store.upsertMany(list);
    setWs(weekStart(new Date(2026, 0, 5).getTime()));
    toast(`${list.length} atividades de janeiro/2026 carregadas`);
  };
  const clearSample = () => {
    const ids = store.acts.filter((a) => /^(EX\d|H\d|J\d)/.test(a.id)).map((a) => a.id);
    store.remove(ids);
    toast(`${ids.length} atividades de exemplo removidas`);
  };
  const doExport = (escopo: "semana" | "tudo") => {
    const list = escopo === "semana" ? range : store.acts;
    if (!list.length) { toast("Não há atividades para exportar"); return; }
    exportPlano(list, ws, Math.min(now, addDays(ws, 7)), store.cfg, escopo);
    toast("Planilha gerada");
  };
  const act = (f: () => void) => () => { setMenu(false); f(); };

  const empty = store.loaded && store.acts.length === 0;

  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand">
            <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="8" fill="var(--accent)" /><path d="M5 26h24M8 26v-4h18v4M11 22v-4h12v4M14 18v-4h6v4" fill="none" stroke="var(--on-accent)" strokeWidth="2" strokeLinejoin="round" /></svg>
            <div style={{ minWidth: 0 }}>
              <h1>Plano Semanal de Lavra</h1>
              <div className="wk" style={{ position: "relative" }}>
                <button onClick={() => setWs(addDays(ws, -7))} aria-label="Semana anterior">‹</button>
                <button className="pk-btn num" onClick={() => setPicker(!picker)} aria-expanded={picker} title="Escolher período">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                  Semana {wn} · {wr}
                </button>
                {picker && <PeriodPicker ws={ws} now={now} acts={store.acts} onPick={setWs} onClose={() => setPicker(false)} />}
                <button onClick={() => setWs(addDays(ws, 7))} aria-label="Próxima semana">›</button>
                {ws !== curWs && <button className="today-btn" onClick={() => setWs(curWs)}>Hoje</button>}
              </div>
            </div>
          </div>
          <nav className="tabs" aria-label="Telas">
            {VIEWS.map((v) => <a key={v} href={`#${v}`} aria-current={view === v ? "page" : undefined}>{LABEL[v]}</a>)}
          </nav>
          <div className="top-actions">
            <span className={`sync hide-m ${store.sync}`} title="Plano único, compartilhado por todos que usam o app" onClick={() => store.sync === "erro" && void store.retry()}><i />{SYNC_TXT[store.sync]}</span>
            <button className="btn hide-m" onClick={() => setSheet({ k: "import" })}>{Icon.down}<span className="lg">Importar Excel</span></button>
            <div style={{ position: "relative" }}>
              <button className="iconbtn" aria-label="Mais opções" aria-expanded={menu} onClick={() => setMenu(!menu)}>{Icon.more}</button>
              {menu && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 34 }} onClick={() => setMenu(false)} />
                  <div className="menu" role="menu">
                    <button onClick={act(() => setSheet({ k: "import" }))}>{Icon.down}Importar Excel</button>
                    <button onClick={act(() => doExport("semana"))}>{Icon.up}Exportar semana {wn} (Excel)</button>
                    <button onClick={act(() => doExport("tudo"))}>{Icon.up}Exportar todo o histórico</button>
                    <button onClick={act(() => exportModelo(ws))}>{Icon.file}Baixar planilha modelo</button>
                    <hr />
                    <button onClick={act(() => setSheet({ k: "settings" }))}>{Icon.gear}Metas e capacidades</button>
                    <hr />
                    <button onClick={act(loadSample)}>{Icon.file}Carregar dados de exemplo (para todos)</button>
                    <button onClick={act(loadJan)}>{Icon.file}Carregar janeiro/2026 de exemplo (para todos)</button>
                    {store.acts.some((a) => /^(EX\d|H\d|J\d)/.test(a.id)) && <button onClick={act(clearSample)}>{Icon.trash}Remover dados de exemplo (para todos)</button>}
                  </div>
                </>
              )}
            </div>
            <button className="btn primary" onClick={() => setSheet({ k: "form", id: null })} aria-label="Nova atividade">{Icon.plus}<span className="hide-m">Atividade</span></button>
          </div>
        </div>
      </header>

      <main>
        {bip && (
          <div className="install" style={{ marginBottom: 16 }}>
            <span>Instale o app para abrir direto da tela inicial, inclusive no campo.</span>
            <button className="btn primary" onClick={async () => { bip.prompt(); await bip.userChoice; setBip(null); }}>Instalar</button>
          </div>
        )}
        {!store.loaded ? (
          <div className="empty"><p>Carregando o plano…</p></div>
        ) : empty ? (
          <div className="panel empty">
            <h2>Nenhuma atividade no plano ainda</h2>
            <p>Este é o plano único da equipe: o que for cadastrado aqui aparece para todos que abrirem o app. Importe a planilha que vocês já usam, cadastre as atividades ou carregue uma semana de exemplo para conhecer o app.</p>
            <div className="acts">
              <button className="btn primary" onClick={() => setSheet({ k: "import" })}>{Icon.down}Importar Excel</button>
              <button className="btn" onClick={() => setSheet({ k: "form", id: null })}>{Icon.plus}Nova atividade</button>
              <button className="btn" onClick={loadSample}>Carregar exemplo</button>
            </div>
          </div>
        ) : (
          <>
            {view === "gantt" && <GanttView {...vp} />}
            {view === "hoje" && <HojeView {...vp} />}
            {view === "apontar" && <ApontarView {...vp} />}
            {view === "aderencia" && <AderenciaView {...vp} />}
          </>
        )}
        <div className="foot">
          <span>Plano único da equipe: todos veem e editam os mesmos dados · <span className={`sync ${store.sync}`} style={{ border: 0, padding: 0, background: "none" }}><i />{SYNC_TXT[store.sync]}</span></span>
          <span>BEMISA · Desafio SENAI</span>
        </div>
      </main>

      <nav className="bnav" aria-label="Telas">
        {VIEWS.map((v) => (
          <a key={v} href={`#${v}`} aria-current={view === v ? "page" : undefined}>
            {v === "gantt" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h9M8 12h10M6 18h7" /></svg>}
            {v === "hoje" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" strokeLinecap="round" /></svg>}
            {v === "apontar" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /><path d="M5 20h14" /></svg>}
            {v === "aderencia" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 20V12M10 20V6M15 20v-9M20 20V4" /></svg>}
            {LABEL[v]}
          </a>
        ))}
      </nav>

      {sheet?.k === "update" && sel && (
        <UpdateSheet a={sel} now={now} toast={toast} onClose={() => setSheet(null)}
          onEdit={() => setSheet({ k: "form", id: sel.id })}
          onSave={(a: Atividade) => { store.upsert(a); setSheet(null); toast("Andamento salvo · indicadores atualizados"); }} />
      )}
      {sheet?.k === "form" && (
        <ActivityForm a={sel} ws={ws} onClose={() => setSheet(null)}
          onSave={(a) => { store.upsert(a); setSheet(null); setWs(weekStart(new Date(a.ini).getTime())); toast(sel ? "Plano atualizado" : "Atividade adicionada ao plano"); }}
          onDelete={(id) => { store.remove([id]); setSheet(null); toast("Atividade excluída"); }} />
      )}
      {sheet?.k === "settings" && (
        <SettingsSheet cfg={store.cfg} now={now} onClose={() => setSheet(null)} onSave={(c) => { store.saveCfg(c); setSheet(null); toast("Metas salvas"); }} />
      )}
      {sheet?.k === "import" && (
        <ImportSheet all={store.acts} ws={ws} onClose={() => setSheet(null)}
          onApply={(list) => {
            store.upsertMany(list);
            setSheet(null);
            const first = list.map((a) => new Date(a.ini).getTime()).sort((a, b) => a - b)[0];
            if (first) setWs(weekStart(first));
            toast(`${list.length} atividades importadas`);
          }} />
      )}
      <div className={`toast ${msg ? "on" : ""}`} role="status" aria-live="polite">{msg}</div>
    </>
  );
}
