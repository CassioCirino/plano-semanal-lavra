import { useCallback, useEffect, useRef, useState } from "react";
import type { Atividade, Config } from "./types";
import { DEFAULT_CONFIG } from "./types";

/*
 * Armazenamento:
 *  - Sempre há um cache local (localStorage), para abrir rápido e funcionar sem sinal na mina.
 *  - Se VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estiverem definidas, os dados são
 *    sincronizados com o Supabase (tabelas "atividades" e "config") e as mudanças de
 *    outras pessoas chegam em tempo real. Gravações feitas sem sinal ficam numa fila e
 *    são enviadas quando a conexão volta.
 */

const K_ACTS = "psl.atividades.v1";
const K_CFG = "psl.config.v1";
const K_QUEUE = "psl.fila.v1";

type Op = { t: "up"; a: Atividade } | { t: "del"; id: string } | { t: "cfg"; c: Config };

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
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* armazenamento cheio ou bloqueado */
  }
};

const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const CLOUD = Boolean(SB_URL && SB_KEY);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sbPromise: Promise<any> | null = null;
const supabase = () => {
  if (!sbPromise)
    sbPromise = import("@supabase/supabase-js").then(({ createClient }) => createClient(SB_URL!, SB_KEY!));
  return sbPromise;
};

export type Sync = "local" | "sincronizado" | "enviando" | "offline" | "erro";

export function useStore() {
  const [acts, setActs] = useState<Atividade[]>(() => read(K_ACTS, [] as Atividade[]));
  const [cfg, setCfg] = useState<Config>(() => ({ ...DEFAULT_CONFIG, ...read(K_CFG, {}) }));
  const [sync, setSync] = useState<Sync>(CLOUD ? "enviando" : "local");
  const [loaded, setLoaded] = useState(!CLOUD);
  const queue = useRef<Op[]>(read(K_QUEUE, [] as Op[]));
  const flushing = useRef(false);

  useEffect(() => write(K_ACTS, acts), [acts]);
  useEffect(() => write(K_CFG, cfg), [cfg]);

  const flush = useCallback(async () => {
    if (!CLOUD || flushing.current) return;
    if (!navigator.onLine) { setSync("offline"); return; }
    flushing.current = true;
    try {
      const sb = await supabase();
      while (queue.current.length) {
        const op = queue.current[0];
        let r;
        if (op.t === "up") r = await sb.from("atividades").upsert({ id: op.a.id, data: op.a, updated_at: op.a.updatedAt });
        else if (op.t === "del") r = await sb.from("atividades").delete().eq("id", op.id);
        else r = await sb.from("config").upsert({ id: "geral", data: op.c, updated_at: new Date().toISOString() });
        if (r.error) throw r.error;
        queue.current.shift();
        write(K_QUEUE, queue.current);
      }
      setSync("sincronizado");
    } catch (e) {
      console.error("Falha ao sincronizar", e);
      setSync(navigator.onLine ? "erro" : "offline");
    } finally {
      flushing.current = false;
    }
  }, []);

  const enqueue = useCallback((ops: Op[]) => {
    if (!CLOUD) return;
    queue.current.push(...ops);
    write(K_QUEUE, queue.current);
    setSync("enviando");
    void flush();
  }, [flush]);

  // Carga inicial e tempo real (nuvem)
  useEffect(() => {
    if (!CLOUD) return;
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any;
    (async () => {
      try {
        const sb = await supabase();
        await flush(); // envia o que ficou pendente antes de ler
        const [ra, rc] = await Promise.all([
          sb.from("atividades").select("data"),
          sb.from("config").select("data").eq("id", "geral").maybeSingle(),
        ]);
        if (ra.error) throw ra.error;
        if (!alive) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setActs((ra.data as any[]).map((r) => r.data as Atividade));
        if (rc.data?.data) setCfg({ ...DEFAULT_CONFIG, ...rc.data.data });
        setLoaded(true);
        setSync(queue.current.length ? "enviando" : "sincronizado");
        channel = sb
          .channel("plano")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .on("postgres_changes", { event: "*", schema: "public", table: "atividades" }, (p: any) => {
            if (p.eventType === "DELETE") setActs((xs) => xs.filter((x) => x.id !== p.old.id));
            else {
              const a = p.new.data as Atividade;
              setActs((xs) => {
                const i = xs.findIndex((x) => x.id === a.id);
                if (i < 0) return [...xs, a];
                if (xs[i].updatedAt > a.updatedAt) return xs;
                const n = xs.slice(); n[i] = a; return n;
              });
            }
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .on("postgres_changes", { event: "*", schema: "public", table: "config" }, (p: any) => {
            if (p.new?.data) setCfg({ ...DEFAULT_CONFIG, ...p.new.data });
          })
          .subscribe();
      } catch (e) {
        console.error(e);
        setLoaded(true);
        setSync(navigator.onLine ? "erro" : "offline");
      }
    })();
    const on = () => void flush();
    const off = () => setSync("offline");
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      alive = false;
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      if (channel) void supabase().then((sb) => sb.removeChannel(channel));
    };
  }, [flush]);

  const upsertMany = useCallback((list: Atividade[]) => {
    const ts = new Date().toISOString();
    const stamped = list.map((a) => ({ ...a, updatedAt: ts }));
    setActs((xs) => {
      const m = new Map(xs.map((x) => [x.id, x]));
      stamped.forEach((a) => m.set(a.id, a));
      return [...m.values()];
    });
    enqueue(stamped.map((a) => ({ t: "up", a }) as Op));
  }, [enqueue]);
  const upsert = useCallback((a: Atividade) => upsertMany([a]), [upsertMany]);
  const remove = useCallback((ids: string[]) => {
    setActs((xs) => xs.filter((x) => !ids.includes(x.id)));
    enqueue(ids.map((id) => ({ t: "del", id }) as Op));
  }, [enqueue]);
  const saveCfg = useCallback((c: Config) => {
    setCfg(c);
    enqueue([{ t: "cfg", c }]);
  }, [enqueue]);

  return { acts, cfg, sync, loaded, upsert, upsertMany, remove, saveCfg, retry: flush };
}

export const newId = () =>
  "A" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
