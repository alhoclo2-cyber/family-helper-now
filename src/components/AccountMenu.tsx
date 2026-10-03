import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const itemCls = "py-3 text-base cursor-pointer";

export function AccountMenu() {
  const { session } = useSession();
  const qc = useQueryClient();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="text-sm font-semibold text-primary underline">
          ☰ Menu
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-2rem)] sm:max-w-[440px]">
        {session ? (
          <>
            <DropdownMenuItem asChild className={itemCls}>
              <Link to="/compte/pause">Mettre en pause mon compte</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className={`${itemCls} text-destructive focus:text-destructive`}>
              <Link to="/compte/suppression">Supprimer mon compte</Link>
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
