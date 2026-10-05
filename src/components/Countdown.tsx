"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCountdown } from "@/lib/domain/trip";

/** Compte à rebours jusqu'à l'heure limite ; recharge la page quand il arrive à 0. */
export function Countdown({ deadline, expiredLabel = "C'est l'heure !" }: { deadline: string; expiredLabel?: string }) {
  const router = useRouter();
  const target = new Date(deadline).getTime();
  const [now, setNow] = useState<number | null>(null);
  const refreshed = useRef(false);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = now == null ? null : target - now;

  useEffect(() => {
    if (remaining != null && remaining <= 0 && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [remaining, router]);

  if (remaining == null) return <span className="tabular-nums">…</span>;
  if (remaining <= 0) return <span>{expiredLabel}</span>;
  return <span className="tabular-nums">{formatCountdown(remaining)}</span>;
}
