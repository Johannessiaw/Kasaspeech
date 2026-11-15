import type { Metadata } from "next";
import { TranscriptionHistory } from "@/components/transcription-history";

export const metadata: Metadata = {
  title: "Transcriptions | KasaSpeech AI Studio",
};

export default function TranscriptionsPage() {
  return <TranscriptionHistory />;
}
