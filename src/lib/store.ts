import { useCallback, useEffect, useRef, useState } from "react";
import type { Atividade, Config } from "./types";
import { DEFAULT_CONFIG } from "./types";

/*
 * Armazenamento
 *  - Cache local (localStorage): o app abre rápido e funciona sem sinal na mina.
 *  - Espaço compartilhado da equipe (opcional): um documento JSON guardado pela função
 *    /api/blob da Vercel (banco Redis/Upstash ligado ao projeto), criado com um toque. Quem abre o link com ?equipe=<id>
 *    entra no mesmo espaço. O app junta as mudanças locais com as da nuvem atividade por
 *    atividade (vence a alteração mais recente), então duas pessoas apontando ao mesmo
 *    tempo não se sobrescrevem. Sem sinal, as mudanças ficam no aparelho e sobem depois.
 *  - Quem tem o link consegue ver e editar os dados (é um protótipo, sem login).
 */

const K_ACTS = "psl.atividades.v1";
const K_CFG = "psl.config.v1";
const K_DEL = "psl.excluidas.v1";
const K_CFGAT = "psl.config.at.v1";
const K_TEAM = "psl.equipe.v1";
export const BLOB_API = "/api/blob";

interface Doc {
  app: "plano-semanal-lavra";
  v: 1;
  acts: Atividade[];
  deleted: Record<string, string>; // id -> data da exclusão
  cfg: Config | null;
  cfgAt: string | null;
}

const read = <T,>(k: string, fb: T): T => {
  try {
    const s = localStorage.getItem(k);
    return s ? (JSON.parse(s) as T) : fb;
  } catch {
    return fb;
  }
};
const write = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* armazenamento cheio ou bloqueado */
  }
};

/** Junta dois estados: por atividade vence o updatedAt mais recente; exclusões valem se forem mais novas. */
export function merge(a: Pick<Doc, "acts" | "deleted" | "cfg" | "cfgAt">, b: Pick<Doc, "acts" | "deleted" | "cfg" | "cfgAt">) {
  const deleted: Record<string, string> = { ...a.deleted };
  for (const [id, t] of Object.entries(b.deleted ?? {})) if (!deleted[id] || deleted[id] < t) deleted[id] = t;
  const m = new Map<string, Atividade>();
  for (const x of [...(a.acts ?? []), ...(b.acts ?? [])]) {
    const cur = m.get(x.id);
    if (!cur || (x.updatedAt ?? "") > (cur.updatedAt ?? "")) m.set(x.id, x);
  }
  const acts = [...m.values()].filter((x) => !deleted[x.id] || deleted[x.id] < (x.updatedAt ?? ""));
  const useA = (a.cfgAt ?? "") >= (b.cfgAt ?? "");
  return { acts, deleted, cfg: useA ? a.cfg : b.cfg, cfgAt: useA ? a.cfgAt : b.cfgAt };
}
const sig = (d: { acts: Atividade[]; deleted: Record<string, string>; cfgAt: string | null }) =>
  JSON.stringify([d.acts.map((x) => x.id + x.updatedAt).sort(), Object.keys(d.deleted).sort(), d.cfgAt]);

export type Sync = "local" | "sincronizado" | "enviando" | "offline" | "erro";

export function teamFromUrl(): string | null {
  try {
    const u = new URL(location.href);
    const id = u.searchParams.get("equipe");
    if (id && /^[\w-]{6,80}$/.test(id)) {
      u.searchParams.delete("equipe");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
      return id;
    }
  } catch { /* */ }
  return null;
}
export const teamLink = (id: string) => `${location.origin}${location.pathname}?equipe=${id}`;

export function useStore() {
  const [acts, setActs] = useState<Atividade[]>(() => read(K_ACTS, [] as Atividade[]));
  const [cfg, setCfg] = useState<Config>(() => ({ ...DEFAULT_CONFIG, ...read(K_CFG, {}) }));
  const [team, setTeam] = useState<string | null>(() => {
    const fromUrl = teamFromUrl();
    if (fromUrl) write(K_TEAM, fromUrl);
    return fromUrl ?? read<string | null>(K_TEAM, null);
  });
  const [sync, setSync] = useState<Sync>(team ? "enviando" : "local");
  const [loaded, setLoaded] = useState(!team);
  const deleted = useRef<Record<string, string>>(read(K_DEL, {}));
  const cfgAt = useRef<string | null>(read(K_CFGAT, null));
  const state = useRef({ acts, cfg });
  state.current = { acts, cfg };
  const busy = useRef(false);
  const again = useRef(false);

  useEffect(() => write(K_ACTS, acts), [acts]);
  useEffect(() => write(K_CFG, cfg), [cfg]);

  const doSync = useCallback(async () => {
    if (!team) return;
    if (busy.current) { again.current = true; return; }
    if (!navigator.onLine) { setSync("offline"); return; }
    busy.current = true;
    try {
      do {
        again.current = false;
        const r = await fetch(`${BLOB_API}?id=${team}`, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!r.ok) throw new Error("GET " + r.status);
        const remote = (await r.json()) as Partial<Doc>;
        const rem = { acts: remote.acts ?? [], deleted: remote.deleted ?? {}, cfg: remote.cfg ?? null, cfgAt: remote.cfgAt ?? null };
        const loc = { acts: state.current.acts, deleted: deleted.current, cfg: state.current.cfg, cfgAt: cfgAt.current };
        const mg = merge(loc, rem);
        if (sig(mg) !== sig(rem)) {
          setSync("enviando");
          const doc: Doc = { app: "plano-semanal-lavra", v: 1, ...mg };
          const w = await fetch(`${BLOB_API}?id=${team}`, {
            method: "PUT", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(doc),
          });
          if (!w.ok) throw new Error("PUT " + w.status);
        }
        if (sig(mg) !== sig(loc) || mg.cfgAt !== loc.cfgAt) {
          setActs(mg.acts);
          if (mg.cfg) setCfg({ ...DEFAULT_CONFIG, ...mg.cfg });
        }
        deleted.current = mg.deleted; write(K_DEL, mg.deleted);
        cfgAt.current = mg.cfgAt; write(K_CFGAT, mg.cfgAt);
      } while (again.current);
      setSync("sincronizado");
    } catch (e) {
      console.error("Falha ao sincronizar", e);
      setSync(navigator.onLine ? "erro" : "offline");
    } finally {
      busy.current = false;
      setLoaded(true);
    }
  }, [team]);

  // Sincroniza ao abrir, a cada 20 s, ao voltar o sinal e ao voltar para o app
  useEffect(() => {
    if (!team) { setSync("local"); setLoaded(true); return; }
    void doSync();
    const t = setInterval(() => document.visibilityState === "visible" && void doSync(), 30000);
    const on = () => void doSync();
    const off = () => setSync("offline");
    const vis = () => document.visibilityState === "visible" && void doSync();
    addEventListener("online", on); addEventListener("offline", off); document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); removeEventListener("online", on); removeEventListener("offline", off); document.removeEventListener("visibilitychange", vis); };
  }, [team, doSync]);

  const debounce = useRef<number>();
  const push = useCallback(() => {
    if (!team) return;
    setSync("enviando");
    clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => void doSync(), 600);
  }, [team, doSync]);

  const upsertMany = useCallback((list: Atividade[]) => {
    const ts = new Date().toISOString();
    const stamped = list.map((a) => ({ ...a, updatedAt: ts }));
    setActs((xs) => {
      const m = new Map(xs.map((x) => [x.id, x]));
      stamped.forEach((a) => m.set(a.id, a));
      const next = [...m.values()];
      state.current = { ...state.current, acts: next };
      return next;
    });
    push();
  }, [push]);
  const upsert = useCallback((a: Atividade) => upsertMany([a]), [upsertMany]);
  const remove = useCallback((ids: string[]) => {
    const ts = new Date().toISOString();
    ids.forEach((id) => (deleted.current[id] = ts));
    write(K_DEL, deleted.current);
    setActs((xs) => {
      const next = xs.filter((x) => !ids.includes(x.id));
      state.current = { ...state.current, acts: next };
      return next;
    });
    push();
  }, [push]);
  const saveCfg = useCallback((c: Config) => {
    cfgAt.current = new Date().toISOString(); write(K_CFGAT, cfgAt.current);
    state.current = { ...state.current, cfg: c };
    setCfg(c);
    push();
  }, [push]);

  /** Cria o espaço da equipe com os dados atuais deste aparelho e devolve o id. */
  const createTeam = useCallback(async () => {
    const doc: Doc = { app: "plano-semanal-lavra", v: 1, acts: state.current.acts, deleted: deleted.current, cfg: state.current.cfg, cfgAt: cfgAt.current ?? new Date().toISOString() };
    const r = await fetch(BLOB_API, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(doc) });
    if (!r.ok) throw new Error(r.status === 503 ? "sem-banco" : "POST " + r.status);
    const { id } = (await r.json()) as { id?: string };
    if (!id) throw new Error("sem id");
    write(K_TEAM, id);
    setTeam(id);
    return id;
  }, []);
  const leaveTeam = useCallback(() => { write(K_TEAM, null); setTeam(null); }, []);

  return { acts, cfg, sync, loaded, team, upsert, upsertMany, remove, saveCfg, retry: doSync, createTeam, leaveTeam };
}

export const newId = () =>
  "A" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
