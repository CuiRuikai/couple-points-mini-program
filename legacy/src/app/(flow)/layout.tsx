import { RequireAuth } from "@/components/auth/RequireAuth";

export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
