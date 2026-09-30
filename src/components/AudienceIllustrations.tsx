type Audience = "seniors" | "children" | "maternity" | "recovery" | "injury";

/** A fixed-size artwork slot; the SVG can later be replaced by a round object-cover image. */
export function AudienceMedallion({ audience }: { audience: Audience }) {
  return (
    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-audience-ring bg-audience-peach" aria-hidden="true">
      <svg viewBox="0 0 64 64" className="size-full" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {audience === "seniors" && (
          <>
            <path d="M14 55c1-10 6-16 15-16s14 6 15 16" className="fill-audience-sage stroke-audience-terracotta" />
            <path d="M24 18c-1-5 2-9 7-9 6 0 9 5 8 10l-2 6H25z" className="fill-audience-sage stroke-audience-terracotta" />
            <path d="M24 25c0 7 3 12 8 12s8-5 8-12v-4c-5 0-10-1-15-4z" className="fill-audience-peach stroke-audience-terracotta" />
            <path d="M38 44c5 1 8 4 9 8" className="stroke-audience-terracotta" />
            <path d="M43 45h12v8c0 3-2 5-5 5h-2c-3 0-5-2-5-5zM55 47h2c3 0 3 5-2 5" className="fill-audience-peach stroke-audience-terracotta" />
          </>
        )}
        {audience === "children" && (
          <>
            <path d="M16 55c1-9 5-14 13-14s12 5 13 14" className="fill-audience-sage stroke-audience-terracotta" />
            <path d="M22 20c0-5 3-8 8-8s8 3 8 8v7c0 7-4 12-8 12s-8-5-8-12z" className="fill-audience-peach stroke-audience-terracotta" />
            <path d="M22 22c3-1 5-3 6-6 2 3 5 5 10 5" className="stroke-audience-terracotta" />
            <path d="M40 45l8-17 4 2-8 17-5 4z" className="fill-audience-sage stroke-audience-terracotta" />
            <path d="M39 51l-1 4 5-2" className="stroke-audience-terracotta" />
          </>
        )}
        {audience === "maternity" && (
          <>
            <path d="M25 16c0-5 3-8 7-8s7 3 7 8v5c0 5-3 8-7 8s-7-3-7-8z" className="fill-audience-peach stroke-audience-terracotta" />
            <path d="M25 14c2-6 10-8 15-2l-1 6c-4-1-8-3-10-6-1 3-2 5-4 6z" className="fill-audience-sage stroke-audience-terracotta" />
            <path d="M25 31c-5 4-8 12-8 25h31c0-9-4-16-10-19l-5-6z" className="fill-audience-sage stroke-audience-terracotta" />
            <path d="M34 36c10 0 16 6 16 13 0 4-4 7-10 7H26" className="fill-audience-peach stroke-audience-terracotta" />
            <path d="M24 44c3 6 7 9 15 9" className="stroke-audience-terracotta" />
          </>
        )}
        {audience === "recovery" && (
          <>
            <path d="M11 39c0-4 3-7 7-7h28c4 0 7 3 7 7v14H11z" className="fill-audience-sage stroke-audience-terracotta" />
            <path d="M8 44c0-3 2-5 5-5s5 2 5 5v10H8zM46 44c0-3 2-5 5-5s5 2 5 5v10H46z" className="fill-audience-peach stroke-audience-terracotta" />
            <path d="M13 54v4m38-4v4" className="stroke-audience-terracotta" />
            <path d="M28 16c0-5 3-8 7-8s7 3 7 8v4c0 5-3 8-7 8s-7-3-7-8z" className="fill-audience-peach stroke-audience-terracotta" />
            <path d="M24 36c2-5 6-8 11-8 7 0 12 4 13 9" className="fill-audience-peach stroke-audience-terracotta" />
            <path d="M20 38c10 4 21 4 27 0l3 8c-11 4-22 4-32 0z" className="fill-audience-peach stroke-audience-terracotta" />
          </>
        )}
        {audience === "injury" && (
          <>
            <path d="M23 15c0-5 3-8 8-8s8 3 8 8v5c0 6-3 9-8 9s-8-3-8-9z" className="fill-audience-peach stroke-audience-terracotta" />
            <path d="M24 13c1-5 5-7 9-7 5 0 8 4 7 10-4-1-7-3-9-6-2 3-4 5-7 6z" className="fill-audience-sage stroke-audience-terracotta" />
            <path d="M23 32c-6 5-8 13-8 24h32c0-11-2-19-8-24z" className="fill-audience-sage stroke-audience-terracotta" />
            <path d="M18 36l10 11h13l4-11M30 34l9 9" className="stroke-audience-terracotta" />
            <path d="M44 38c4 0 7 2 8 6l-4 4-4-4-4 4-4-4c1-4 4-6 8-6z" className="fill-audience-peach stroke-audience-terracotta" />
          </>
        )}
      </svg>
    </span>
  );
}