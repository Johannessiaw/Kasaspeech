import type { Metadata } from "next";
import { LanguageTaskWorkspace } from "@/components/language-task-workspace";

export const metadata: Metadata = {
  title: "Translator | LINGUA AI",
};

export default function TranslatePage() {
  return <LanguageTaskWorkspace task="translation" />;
}
