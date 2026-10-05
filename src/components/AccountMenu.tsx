import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useAccountState } from "@/lib/accountState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const itemCls = "py-3 text-base cursor-pointer";

export function AccountMenu({ missions }: { missions?: { count: number; onOpen: () => void } } = {}) {
  const { session } = useSession();
  const qc = useQueryClient();
  const { state } = useAccountState(session?.user.id);
  const paused = state.status === "paused";
  const pending = state.status === "deletion_pending";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-foreground bg-background px-3.5 py-2 text-sm font-bold text-foreground shadow-sm transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
        >
          ☰ Menu
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-2rem)] sm:max-w-[440px]">
        {missions && (
          <>
            <DropdownMenuItem className={`${itemCls} font-bold`} onSelect={missions.onOpen}>
              <span className="flex w-full items-center justify-between gap-2">
                Missions proposées
                <span className="min-w-7 rounded-full bg-mission-violet px-2 py-0.5 text-center text-sm font-black text-background">
                  {missions.count}
                </span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {session ? (
          <>
            <DropdownMenuItem asChild className={itemCls}>
              <Link to="/compte/pause">{paused ? "Réactiver mon compte" : "Mettre en pause mon compte"}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              asChild
              className={pending ? itemCls : `${itemCls} text-destructive focus:text-destructive`}
            >
              <Link to="/compte/suppression">{pending ? "Annuler la suppression" : "Supprimer mon compte"}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={itemCls}
              onSelect={async () => {
                await qc.cancelQueries();
                qc.clear();
                await supabase.auth.signOut();
              }}
            >
              Se déconnecter
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild className={itemCls}>
              <Link to="/auth">Se connecter</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={itemCls}>
              <Link to="/archives">Accéder à mes archives</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
