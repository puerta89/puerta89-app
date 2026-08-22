/** Isotipo de Puerta 89: la puerta del local, con su ventana partida en nueve. */
export default function Arco({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-3 -3 106 132"
      className={className}
      role="img"
      aria-label="Puerta 89"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      >
        <path d="M0 126 V50 A50 50 0 0 1 100 50 V126 Z" />
        <path d="M0 50 H100" />
        <path d="M34 50 A16 16 0 0 1 66 50" />
        <path d="M50 34 V0" />
        <path d="M38.7 38.7 L14.6 14.6" />
        <path d="M61.3 38.7 L85.4 14.6" />
        <path d="M33.3 50 V126 M66.7 50 V126" />
        <path d="M0 75.3 H100 M0 100.7 H100" />
      </g>
    </svg>
  );
}
