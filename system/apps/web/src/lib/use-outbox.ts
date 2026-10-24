import { useEffect, useState } from "react";
import { list, onOutboxChange, type OutboxItem } from "./outbox";

/** Items saved on this phone and not yet on the server. */
export function useOutbox(kind?: OutboxItem["kind"]) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  useEffect(() => {
    let live = true;
    const load = () => { void list().then((l) => { if (live) setItems(kind ? l.filter((i) => i.kind === kind) : l); }); };
    load();
    const off = onOutboxChange(load);
    return () => { live = false; off(); };
  }, [kind]);
  return items;
}
