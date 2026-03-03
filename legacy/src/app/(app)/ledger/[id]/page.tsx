import LedgerDetailClient from "./LedgerDetailClient";

export const dynamic = "force-static";

export async function generateStaticParams() {
  return [{ id: "default" }];
}

export const dynamicParams = false;

export default function Page() {
  return <LedgerDetailClient />;
}
