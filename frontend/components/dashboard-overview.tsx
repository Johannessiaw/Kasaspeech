import {
  Activity,
  AudioLines,
  BrainCircuit,
  Clock3,
  Database,
  Languages,
  Mic,
  Sparkles,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusCards = [
  {
    label: "ASR model",
    value: "Not connected",
    detail: "No inference service is configured.",
    icon: BrainCircuit,
    iconClass: "text-sky-300",
  },
  {
    label: "Transcription sessions",
    value: "No sessions yet",
    detail: "Session history will appear here when available.",
    icon: Mic,
    iconClass: "text-violet-300",
  },
  {
    label: "Evaluation",
    value: "No evaluation data",
    detail: "WER, CER, and latency are not measured yet.",
    icon: Activity,
    iconClass: "text-emerald-300",
  },
];

const services = [
  { name: "Speech recognition", status: "Not connected", icon: AudioLines },
  { name: "Translation", status: "Not configured", icon: Languages },
  { name: "Speech synthesis", status: "Not configured", icon: Volume2 },
];

export function DashboardOverview() {
  return (
    <div className="space-y-7">
      <section className="relative isolate overflow-hidden rounded-3xl border border-white/[0.08] bg-[linear-gradient(115deg,oklch(0.2_0.045_270)_0%,oklch(0.17_0.025_258)_54%,oklch(0.17_0.035_235)_100%)] p-6 shadow-[0_24px_70px_-45px_oklch(0.5_0.2_270_/_55%)] sm:p-8 lg:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-32 -z-10 size-80 rounded-full border border-primary/15"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-20 -z-10 size-56 rounded-full border border-primary/15"
        />
        <div className="pointer-events-none absolute -bottom-28 right-20 -z-10 size-48 rounded-full bg-primary/10 blur-3xl" />

        <div className="max-w-3xl">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge className="border border-primary/25 bg-primary/15 text-violet-100 hover:bg-primary/15">
              <Sparkles aria-hidden="true" />
              Phase 2 · Audio capture
            </Badge>
            <span className="text-xs text-muted-foreground">
              Ghanaian Speech Intelligence. Built for Everyone.
            </span>
          </div>
          <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            Your speech intelligence workspace starts here.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            A dedicated home for Ghanaian English, Twi, and code-switched speech
            experiments. Record and review audio now; model inference and
            connected data will be added in later phases.
          </p>
          <Button
            render={<Link href="/studio" />}
            className="mt-6 h-10 gap-2 bg-violet-500 px-4 text-white hover:bg-violet-400"
          >
            <Mic aria-hidden="true" className="size-4" />
            Open Speech Studio
          </Button>
        </div>
      </section>

      <section aria-label="Workspace overview">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Workspace overview
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Live platform data will appear here when services are connected.
            </p>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Clock3 aria-hidden="true" className="size-3.5" />
            Awaiting first session
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {statusCards.map(({ label, value, detail, icon: Icon, iconClass }) => (
            <Card
              key={label}
              className="border-border/80 bg-card/80 shadow-[0_12px_35px_-28px_rgba(0,0,0,0.8)]"
            >
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1.5">
                  <CardDescription>{label}</CardDescription>
                  <CardTitle className="text-lg font-semibold">{value}</CardTitle>
                </div>
                <span className="rounded-xl border border-border/80 bg-background/70 p-2.5">
                  <Icon aria-hidden="true" className={`size-[18px] ${iconClass}`} />
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="border-border/80 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
            <CardDescription>
              Your real transcription and experiment history will be listed here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/35 px-5 py-8 text-center">
              <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Database aria-hidden="true" className="size-5" />
              </span>
              <h3 className="text-sm font-medium">Nothing to show yet</h3>
              <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
                No sessions are stored in this workspace. Activity will show up
                after a real backend and transcription workflow are connected.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Connected services</CardTitle>
            <CardDescription>
              Service status is reported honestly; nothing is mocked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {services.map(({ name, status, icon: Icon }) => (
                <li
                  key={name}
                  className="flex items-center gap-3 border-b border-border/70 pb-4 last:border-0 last:pb-0"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Icon aria-hidden="true" className="size-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-sky-300/15 bg-sky-300/[0.06] p-3.5">
              <AudioLines
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-sky-200"
              />
              <p className="text-xs leading-5 text-sky-100/80">
                The current milestone is the interface foundation. No Hugging
                Face connection, model download, or external inference call is
                made by this dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center justify-center gap-2 pb-2 text-center text-xs text-muted-foreground">
        <Activity aria-hidden="true" className="size-3.5" />
        Session metrics and model performance will only appear after they are
        actually measured.
      </p>
    </div>
  );
}
