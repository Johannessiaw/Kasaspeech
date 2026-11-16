import type { Metadata } from "next";
import { LanguageTaskWorkspace } from "@/components/language-task-workspace";

export const metadata: Metadata = {
  title: "AI Assistant | LINGUA AI",
};

export default function AssistantPage() {
  return <LanguageTaskWorkspace task="assistant" />;
}
