import type { Metadata } from "next";
import { ProviderConsole } from "@/components/provider-console";

export const metadata: Metadata = {
  title: "API integrations | LINGUA AI",
};

export default function IntegrationsPage() {
  return <ProviderConsole />;
}
