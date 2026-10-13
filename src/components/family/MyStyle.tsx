"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMember } from "@/app/actions/auth";
import type { Profile } from "@/lib/data";
import type { Style } from "@/lib/session";
import { StylePicker } from "./StylePicker";

/** Changer son propre style : l'appli bascule tout de suite. */
export function MyStyle({ me }: { me: Profile }) {
  const [style, setStyle] = useState<Style>(me.style);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className={pending ? "opacity-60" : ""}>
      <StylePicker
        value={style}
        onChange={(next) => {
          setStyle(next);
          const fd = new FormData();
          fd.set("id", me.id);
          fd.set("name", me.name);
          fd.set("emoji", me.emoji);
          fd.set("style", next);
          startTransition(async () => {
            await saveMember({}, fd);
            router.refresh();
          });
        }}
      />
    </div>
  );
}
