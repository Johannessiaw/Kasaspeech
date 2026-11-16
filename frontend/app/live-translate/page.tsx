import type { Metadata } from "next";
import { LiveTranslateWorkspace } from "@/components/live-translate-workspace";

export const metadata: Metadata = {
  title: "Live translate | LINGUA AI",
};

export default function LiveTranslatePage() {
  return <LiveTranslateWorkspace />;
}
