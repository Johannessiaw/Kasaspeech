import type { Metadata } from "next";
import { TranscriptionHistory } from "@/components/transcription-history";

export const metadata: Metadata = {
  title: "Transcriptions | LINGUA AI",
};

export default function TranscriptionsPage() {
  return <TranscriptionHistory />;
}
