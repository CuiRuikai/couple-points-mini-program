import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireCouple } from "@/components/auth/RequireCouple";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireCouple>
        <AppShell>{children}</AppShell>
      </RequireCouple>
    </RequireAuth>
  );
}
