import type { Metadata } from "next";
import { AudioStudio } from "@/components/audio-studio";

export const metadata: Metadata = {
  title: "Speech Studio | KasaSpeech AI Studio",
};

export default function SpeechStudioPage() {
  return <AudioStudio />;
}
