"use client";

import { useState } from "react";

export function ProfileAvatar({
  avatarUrl,
  name,
  size = 96,
  ringClassName = "ring-4 ring-sky-100",
}: {
  avatarUrl: string | null;
  name: string;
  size?: number;
  ringClassName?: string;
}) {
  const [broken, setBroken] = useState(false);
  const initial = (name.trim()[0] ?? "J").toUpperCase();
  const showImg = Boolean(avatarUrl?.trim()) && !broken;

  if (showImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URLs externas de perfil
      <img
        src={avatarUrl!}
        alt=""
        width={size}
        height={size}
        onError={() => setBroken(true)}
        className={`rounded-full object-cover ${ringClassName}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 font-semibold tracking-tight text-white ${ringClassName}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initial}
    </div>
  );
}
