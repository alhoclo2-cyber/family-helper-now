import seniorsAsset from "@/assets/cible-seniors.png.asset.json";
import childrenAsset from "@/assets/cible-enfants.png.asset.json";
import maternityAsset from "@/assets/cible-grossese.png.asset.json";
import recoveryAsset from "@/assets/cible-retour_hospitalisation.png.asset.json";
import injuryAsset from "@/assets/cible-blessures.png.asset.json";

type Audience = "seniors" | "children" | "maternity" | "recovery" | "injury";

const AUDIENCE_IMAGES: Record<Audience, string> = {
  seniors: seniorsAsset.url,
  children: childrenAsset.url,
  maternity: maternityAsset.url,
  recovery: recoveryAsset.url,
  injury: injuryAsset.url,
};

/**
 * Each artwork is drawn as a circle inside a slightly larger cream canvas, and the canvas
 * is not perfectly square, so `object-cover` alone leaves a pale ring inside the medallion.
 * These per-file values zoom each artwork just enough for its own circle to sit on the
 * medallion edge and nudge it back to the centre. The pictures themselves are untouched.
 */
const AUDIENCE_FIT: Record<Audience, { zoom: number; x: number; y: number }> = {
  seniors: { zoom: 1.071, x: -0.32, y: -0.32 },
  children: { zoom: 1.04, x: -2.51, y: 1.25 },
  maternity: { zoom: 1.12, x: -2.17, y: -2.48 },
  recovery: { zoom: 1.082, x: 0.63, y: 0.63 },
  injury: { zoom: 1.25, x: 0.36, y: 1.07 },
};

/** A fixed-size artwork slot showing the audience illustration as a round object-cover image. */
export function AudienceMedallion({ audience }: { audience: Audience }) {
  const fit = AUDIENCE_FIT[audience];
  return (
    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-audience-ring bg-audience-peach" aria-hidden="true">
      <img
        src={AUDIENCE_IMAGES[audience]}
        alt=""
        className="size-full object-cover"
        style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.zoom})` }}
        loading="lazy"
      />
    </span>
  );
}
