"use client";

import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ACCOUNT_ACTION_LABELS,
  PROFILE_HREF,
} from "@/features/account/account-actions";
import { SignOutConfirmDialog } from "@/features/account/sign-out-confirm-dialog";
import { useSignOut } from "@/features/account/use-sign-out";
import { initialsOf } from "@/lib/user/initials";
import { useUserStore } from "@/stores/user-store";

/**
 * Menú de cuenta del escritorio (KAM-24): avatar con iniciales, sin foto, y
 * dos ítems iguales para ambos roles — Perfil y Cerrar sesión.
 */
export function UserMenu() {
  const displayName = useUserStore(
    (state) => state.membership?.displayName ?? null,
  );
  const email = useUserStore((state) => state.user?.email ?? null);
  const {
    requestSignOut,
    confirmSignOut,
    confirming,
    setConfirming,
    pending,
    pendingCount,
  } = useSignOut();

  const initials = initialsOf(displayName) ?? initialsOf(email) ?? "?";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid="account-menu-trigger"
            aria-label="Menú de cuenta"
          >
            <Avatar size="sm">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" data-testid="account-menu">
          <DropdownMenuItem asChild data-testid="account-menu-profile">
            <Link href={PROFILE_HREF}>{ACCOUNT_ACTION_LABELS.profile}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="account-menu-sign-out"
            onSelect={(event) => {
              event.preventDefault();
              requestSignOut();
            }}
          >
            {ACCOUNT_ACTION_LABELS.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        pending={pending}
        pendingCount={pendingCount}
        onConfirm={confirmSignOut}
      />
    </>
  );
}
