import type { Metadata } from "next";
import { LanguageTaskWorkspace } from "@/components/language-task-workspace";

export const metadata: Metadata = {
  title: "Text to speech | LINGUA AI",
};

export default function TextToSpeechPage() {
  return <LanguageTaskWorkspace task="tts" />;
}
