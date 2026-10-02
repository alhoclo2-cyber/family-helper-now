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

/** A fixed-size artwork slot showing the audience illustration as a round object-cover image. */
export function AudienceMedallion({ audience }: { audience: Audience }) {
  return (
    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-audience-ring bg-audience-peach" aria-hidden="true">
      <img src={AUDIENCE_IMAGES[audience]} alt="" className="size-full object-cover" loading="lazy" />
    </span>
  );
}
