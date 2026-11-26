import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Atividade, Config } from "./lib/types";
import { FRENTES, MOTIVOS, TIPOS } from "./lib/types";
import { expct, fmt, fq, isBehind, pct, status } from "./lib/calc";
import { addDays, fmtDH, fromLocalInput, monthKey, ms, toLocalInput, MESES_FULL, HOUR } from "./lib/time";
import { newId, teamLink } from "./lib/store";
import { importPlano, exportModelo, type ImportResult } from "./lib/excel";
import { CritMark, Pill } from "./ui";

export function Sheet({ title, eyebrow, sub, onClose, children, footer, className }: {
  title: ReactNode; eyebrow?: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; footer: ReactNode; className?: string;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet ${className ?? ""}`} role="dialog" aria-modal="true">
        <div className="sheet-h">
          <div style={{ minWidth: 0 }}>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h3 style={{ fontSize: 21 }}>{title}</h3>
            {sub && <div className="muted" style={{ fontSize: 12.5 }}>{sub}</div>}
          </div>
          <button className="x" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="sheet-b">{children}</div>
        <div className="sheet-f">{footer}</div>
      </div>
    </div>
  );
}

export function UpdateSheet({ a, now, onClose, onSave, onEdit, toast }: {
  a: Atividade; now: number; onClose: () => void; onSave: (a: Atividade) => void; onEdit: () => void; toast: (m: string) => void;
}) {
  const [d, setD] = useState<Atividade>({ ...a });
  const s = status(d, now), p = pct(d), e = expct(d, now), behind = isBehind(s);
  const set = (patch: Partial<Atividade>) => setD((x) => ({ ...x, ...patch }));
  const setPct = (v: number) => {
    const real = Math.round(((a.meta * v) / 100) * 10) / 10;
    const patch: Partial<Atividade> = { real };
    if (real > 0 && !d.iniReal) patch.iniReal = new Date(Math.max(ms(a.ini), now - HOUR)).toISOString();
    if (v >= 100 && !d.fimReal) patch.fimReal = new Date(now).toISOString();
    if (v < 100) patch.fimReal = null;
    set(patch);
  };
  const save = () => {
    if (behind && !d.motivo) { toast("Escolha o motivo do desvio para salvar"); return; }
    const out = { ...d };
    if (out.real > 0 && !out.iniReal) out.iniReal = new Date(Math.max(ms(a.ini), now - HOUR)).toISOString();
    onSave(out);
  };
  return (
    <Sheet className={`s-${s}`} onClose={onClose}
      eyebrow={<>{a.frente} · {a.local}</>}
      title={<><CritMark a={d} />{a.nome}</>}
      sub={<>{a.equip} · plano {fmtDH(ms(a.ini))} → {fmtDH(ms(a.fim))}</>}
      footer={<>
        <button className="btn" onClick={onEdit}>Editar plano</button>
        <button className="btn primary" onClick={save}>Salvar andamento</button>
      </>}>
      <div className="big"><span className="p num" style={{ color: "var(--c)" }}>{fmt(p)}%</span><span><Pill s={s} /></span><span className="muted num" style={{ fontSize: 12.5, marginLeft: "auto" }}>previsto agora {fmt(e)}%</span></div>
      <div className="prog"><i style={{ width: `${p}%` }} />{e > 0 && e < 100 && <b style={{ left: `${e}%` }} />}</div>
      <div className="field"><label htmlFor="uR">Andamento (%)</label>
        <input type="range" id="uR" min={0} max={100} step={1} value={Math.round(p)} onChange={(ev) => setPct(+ev.target.value)} /></div>
      <div className="two">
        <div className="field"><label htmlFor="uQ">Realizado ({a.un})</label>
          <input className="inp num" id="uQ" type="number" inputMode="decimal" min={0} step="any" value={d.real}
            onChange={(ev) => set({ real: Math.max(0, parseFloat(ev.target.value) || 0) })} /></div>
        <div className="field"><span className="lbl">Meta</span><div className="inp num" style={{ background: "var(--surface-2)" }}>{fq(a.meta, a.un)}</div></div>
      </div>
      <div className="quick">{[10, 25, 50, 75, 100].map((v) => <button key={v} className="qbtn" onClick={() => setPct(v)}>{v}%</button>)}</div>
      <div className="two">
        <div className="field"><label htmlFor="uI">Início real</label>
          <input className="inp" id="uI" type="datetime-local" value={toLocalInput(d.iniReal)} onChange={(ev) => set({ iniReal: fromLocalInput(ev.target.value) })} /></div>
        <div className="field"><label htmlFor="uF">Término real</label>
          <input className="inp" id="uF" type="datetime-local" value={toLocalInput(d.fimReal)} onChange={(ev) => set({ fimReal: fromLocalInput(ev.target.value) })} /></div>
      </div>
      <div className="field"><span className="lbl">Motivo do desvio {behind && <span className="bad">· obrigatório para atraso</span>}</span>
        <div className="chips">{MOTIVOS.map((m) => (
          <button key={m} className="chip" aria-pressed={d.motivo === m} onClick={() => set({ motivo: d.motivo === m ? "" : m })}>{m}</button>
        ))}</div></div>
      <div className="field"><label htmlFor="uO">Observação</label>
        <textarea className="inp" id="uO" rows={2} placeholder="Ex.: ESC-02 liberada às 13h, voltou para a bancada 795" value={d.obs} onChange={(ev) => set({ obs: ev.target.value })} /></div>
      <label className="check"><input type="checkbox" checked={d.critica} onChange={(ev) => set({ critica: ev.target.checked })} /> Atividade crítica (destacar no Gantt e nos alertas)</label>
    </Sheet>
  );
}

export function ActivityForm({ a, ws, onClose, onSave, onDelete }: {
  a: Atividade | null; ws: number; onClose: () => void; onSave: (a: Atividade) => void; onDelete: (id: string) => void;
}) {
  const base: Atividade = a ?? {
    id: newId(), nome: TIPOS[0].nome, tipo: "rom", frente: FRENTES[0], local: "", equip: "",
    ini: new Date(addDays(ws, 0) + 7 * HOUR).toISOString(), fim: new Date(addDays(ws, 4) + 19 * HOUR).toISOString(),
    meta: 0, un: "t", real: 0, iniReal: null, fimReal: null, critica: false, motivo: "", obs: "", updatedAt: "",
  };
  const [d, setD] = useState<Atividade>(base);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState("");
  const set = (patch: Partial<Atividade>) => setD((x) => ({ ...x, ...patch }));
  const tipoIdx = TIPOS.findIndex((t) => t.nome === d.nome);
  const save = () => {
    if (!d.nome.trim()) return setErr("Informe a atividade.");
    if (!(ms(d.fim) > ms(d.ini))) return setErr("O fim planejado precisa ser depois do início.");
    if (!(d.meta > 0)) return setErr("Informe a meta.");
    onSave({ ...d, local: d.local.trim() || "—", equip: d.equip.trim() || "—" });
  };
  return (
    <Sheet onClose={onClose} eyebrow={a ? "Editar plano" : "Plano da semana"} title={a ? a.nome : "Nova atividade"}
      footer={<>
        {a && (confirmDel
          ? <button className="btn danger" onClick={() => onDelete(a.id)}>Confirmar exclusão</button>
          : <button className="btn danger" onClick={() => setConfirmDel(true)}>Excluir</button>)}
        <span style={{ flex: 1 }} className="hide-m" />
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" onClick={save}>{a ? "Salvar" : "Adicionar ao plano"}</button>
      </>}>
      <div className="two">
        <div className="field"><label htmlFor="fT">Tipo de atividade</label>
          <select className="inp" id="fT" value={tipoIdx >= 0 ? tipoIdx : "outro"} onChange={(ev) => {
            const v = ev.target.value;
            if (v === "outro") set({ nome: "", tipo: "geo" });
            else { const t = TIPOS[+v]; set({ nome: t.nome, tipo: t.tipo, un: t.un }); }
          }}>
            {TIPOS.map((t, i) => <option key={t.nome} value={i}>{t.nome} ({t.un})</option>)}
            <option value="outro">Outra…</option>
          </select></div>
        <div className="field"><label htmlFor="fN">Nome</label>
          <input className="inp" id="fN" value={d.nome} onChange={(ev) => set({ nome: ev.target.value })} /></div>
      </div>
      <div className="two">
        <div className="field"><label htmlFor="fFr">Frente</label>
          <input className="inp" id="fFr" list="frentes" value={d.frente} onChange={(ev) => set({ frente: ev.target.value })} />
          <datalist id="frentes">{FRENTES.map((f) => <option key={f} value={f} />)}</datalist></div>
        <div className="field"><label htmlFor="fL">Local</label>
          <input className="inp" id="fL" placeholder="Bancada 800" value={d.local} onChange={(ev) => set({ local: ev.target.value })} /></div>
      </div>
      <div className="field"><label htmlFor="fE">Equipamento</label>
        <input className="inp" id="fE" placeholder="ESC-02 PC1250 + 4× CAT 777" value={d.equip} onChange={(ev) => set({ equip: ev.target.value })} /></div>
      <div className="two">
        <div className="field"><label htmlFor="fI">Início planejado</label>
          <input className="inp" id="fI" type="datetime-local" value={toLocalInput(d.ini)} onChange={(ev) => set({ ini: fromLocalInput(ev.target.value) ?? d.ini })} /></div>
        <div className="field"><label htmlFor="fF">Fim planejado</label>
          <input className="inp" id="fF" type="datetime-local" value={toLocalInput(d.fim)} onChange={(ev) => set({ fim: fromLocalInput(ev.target.value) ?? d.fim })} /></div>
      </div>
      <div className="two">
        <div className="field"><label htmlFor="fM">Meta</label>
          <input className="inp num" id="fM" type="number" inputMode="decimal" min={0} step="any" value={d.meta || ""} onChange={(ev) => set({ meta: parseFloat(ev.target.value) || 0 })} /></div>
        <div className="field"><label htmlFor="fU">Unidade</label>
          <select className="inp" id="fU" value={d.un} onChange={(ev) => set({ un: ev.target.value })}>
            {["t", "m³", "m", "m²", "km", "fogo", "h"].map((u) => <option key={u}>{u}</option>)}
          </select></div>
      </div>
      <div className="field"><label htmlFor="fC2">Destino / indicador</label>
        <select className="inp" id="fC2" value={d.tipo} onChange={(ev) => set({ tipo: ev.target.value as Atividade["tipo"] })}>
          <option value="rom">ROM → UTM (conta na movimentação)</option>
          <option value="est">Estéril → pilha (conta na movimentação)</option>
          <option value="geo">Geometria (perfuração, desmonte, acessos, bermas…)</option>
        </select></div>
      <label className="check"><input type="checkbox" checked={d.critica} onChange={(ev) => set({ critica: ev.target.checked })} /> Atividade crítica</label>
      {err && <div className="errs">{err}</div>}
    </Sheet>
  );
}

export function SettingsSheet({ cfg, now, onClose, onSave }: { cfg: Config; now: number; onClose: () => void; onSave: (c: Config) => void }) {
  const mk = monthKey(now);
  const [c, setC] = useState<Config>(cfg);
  const orc = c.orcamento[mk] ?? c.orcamentoPadrao;
  const setOrc = (k: keyof typeof orc, v: number) => setC({ ...c, orcamento: { ...c.orcamento, [mk]: { ...orc, [k]: v } } });
  const num = (id: string, label: string, v: number, on: (n: number) => void, suf: string) => (
    <div className="field"><label htmlFor={id}>{label} <span className="muted">({suf})</span></label>
      <input className="inp num" id={id} type="number" inputMode="decimal" min={0} step="any" value={v} onChange={(e) => on(parseFloat(e.target.value) || 0)} /></div>
  );
  return (
    <Sheet onClose={onClose} eyebrow="Parâmetros do orçamento" title="Metas e capacidades"
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={() => onSave(c)}>Salvar</button></>}>
      <div className="eyebrow">Orçamento de {MESES_FULL[new Date(now).getMonth()]}</div>
      <div className="two">
        {num("cR", "ROM para a UTM", orc.rom, (n) => setOrc("rom", n), "t no mês")}
        {num("cE", "Estéril para a pilha", orc.est, (n) => setOrc("est", n), "t no mês")}
      </div>
      {num("cM", "Capacidade de movimentação", orc.capMov, (n) => setOrc("capMov", n), "t no mês")}
      <div className="eyebrow">Capacidades</div>
      <div className="two">
        {num("cU", "Capacidade da UTM", c.capUTM, (n) => setC({ ...c, capUTM: n }), "t/dia")}
        {num("cA", "Meta de aderência", c.metaAderencia, (n) => setC({ ...c, metaAderencia: n }), "%")}
      </div>
      <div className="two">
        <div className="field"><label htmlFor="cPn">Pilha de estéril</label><input className="inp" id="cPn" value={c.pdeNome} onChange={(e) => setC({ ...c, pdeNome: e.target.value })} /></div>
        {num("cPc", "Capacidade licenciada", c.pdeCap, (n) => setC({ ...c, pdeCap: n }), "t")}
      </div>
      {num("cPo", "Ocupação da pilha no início do mês", c.pdeOcup, (n) => setC({ ...c, pdeOcup: n }), "t")}
    </Sheet>
  );
}

export function ImportSheet({ all, ws, onClose, onApply }: {
  all: Atividade[]; ws: number; onClose: () => void; onApply: (list: Atividade[]) => void;
}) {
  const [res, setRes] = useState<ImportResult | null>(null);
  const [nome, setNome] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inp = useRef<HTMLInputElement>(null);
  const handle = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setNome(f.name);
    try { setRes(await importPlano(f, all)); }
    catch { setRes({ novas: [], atualizadas: [], erros: ["Não consegui ler o arquivo. Use .xlsx, .xls ou .csv."] }); }
    finally { setBusy(false); }
  };
  const total = res ? res.novas.length + res.atualizadas.length : 0;
  return (
    <Sheet onClose={onClose} eyebrow="Excel" title="Importar plano"
      footer={<>
        <button className="btn" onClick={() => exportModelo(ws)}>Baixar modelo</button>
        <span style={{ flex: 1 }} className="hide-m" />
        <button className="btn primary" disabled={!total} onClick={() => res && onApply([...res.novas, ...res.atualizadas])}>
          {total ? `Importar ${total} atividade${total > 1 ? "s" : ""}` : "Importar"}
        </button>
      </>}>
      <p className="muted" style={{ margin: 0 }}>Use a planilha no formato do modelo (uma linha por atividade). Linhas com ID atualizam a atividade existente; sem ID, entram como novas.</p>
      <div className={`drop ${over ? "on" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void handle(e.dataTransfer.files[0]); }}>
        <strong style={{ color: "var(--fg)" }}>{busy ? "Lendo…" : nome || "Arraste a planilha aqui"}</strong>
        <span>ou</span>
        <button className="btn" onClick={() => inp.current?.click()}>Escolher arquivo</button>
        <input ref={inp} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => void handle(e.target.files?.[0])} />
      </div>
      {res && total > 0 && (
        <div className="okbox"><strong>{res.novas.length}</strong> novas e <strong>{res.atualizadas.length}</strong> atualizadas.
          {res.novas.length > 0 && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Ex.: {res.novas.slice(0, 3).map((a) => `${a.nome} (${a.local}, ${fq(a.meta, a.un)})`).join("; ")}</div>}
        </div>
      )}
      {res && res.erros.length > 0 && <div className="errs">{res.erros.map((e, i) => <div key={i}>{e}</div>)}</div>}
    </Sheet>
  );
}

export function ShareSheet({ team, sync, onClose, onCreate, onLeave, toast }: {
  team: string | null; sync: string; onClose: () => void; onCreate: () => Promise<string>; onLeave: () => void; toast: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sair, setSair] = useState(false);
  const link = team ? teamLink(team) : "";
  const inp = useRef<HTMLInputElement>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast("Link copiado"); }
    catch { inp.current?.select(); toast("Selecione e copie o link"); }
  };
  const create = async () => {
    setBusy(true); setErr("");
    try { await onCreate(); toast("Espaço da equipe criado"); }
    catch { setErr("Não consegui criar o espaço agora. Confira a conexão e tente de novo."); }
    finally { setBusy(false); }
  };
  return (
    <Sheet onClose={onClose} eyebrow="Equipe" title={team ? "Espaço compartilhado" : "Compartilhar com a equipe"}
      footer={team ? <>
        {sair ? <button className="btn danger" onClick={onLeave}>Confirmar saída</button> : <button className="btn" onClick={() => setSair(true)}>Sair do espaço</button>}
        <span style={{ flex: 1 }} className="hide-m" />
        {typeof navigator.share === "function" && <button className="btn" onClick={() => navigator.share({ title: "Plano Semanal de Lavra", url: link }).catch(() => {})}>Enviar…</button>}
        <button className="btn primary" onClick={copy}>Copiar link</button>
      </> : <>
        <button className="btn" onClick={onClose}>Agora não</button>
        <button className="btn primary" disabled={busy} onClick={create}>{busy ? "Criando…" : "Criar espaço da equipe"}</button>
      </>}>
      {team ? (
        <>
          <p style={{ margin: 0 }}>Todos que abrirem este link veem e atualizam o mesmo plano. Envie para a equipe de planejamento e da operação.</p>
          <div className="linkbox"><input ref={inp} className="inp" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link do espaço" /></div>
          <div className="muted" style={{ fontSize: 12.5 }}>Situação: {sync === "sincronizado" ? "sincronizado" : sync === "offline" ? "sem sinal, as mudanças sobem quando voltar" : sync === "erro" ? "erro ao sincronizar, tentando de novo" : "sincronizando…"}. Atualiza sozinho a cada 30 segundos.</div>
          <div className="muted" style={{ fontSize: 12.5 }}>Protótipo sem login: quem tiver o link consegue ver e editar os dados.</div>
        </>
      ) : (
        <>
          <p style={{ margin: 0 }}>Cria um espaço online para a equipe com o plano que está neste aparelho. Depois é só enviar o link: quem abrir vê e atualiza o mesmo plano, no celular ou no PC.</p>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Não precisa de conta. Sem sinal, o app continua funcionando e envia as mudanças quando a conexão voltar. Por ser um protótipo sem login, quem tiver o link consegue ver e editar os dados.</p>
          {err && <div className="errs">{err}</div>}
        </>
      )}
    </Sheet>
  );
}
