import { useState } from 'react';

const monogram = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

/** Round profile picture with a monogram fallback. */
export function Portrait({ src, name, size = 34 }: { src: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        className="rounded-circle object-fit-cover flex-shrink-0"
        style={style}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="rounded-circle bg-primary text-white fw-semibold d-inline-flex align-items-center justify-content-center flex-shrink-0" style={style}>
      {monogram(name)}
    </span>
  );
}
