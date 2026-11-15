"use client";

import Link from "next/link";
import {
  Activity,
  AudioLines,
  Database,
  FlaskConical,
  History,
  Languages,
  LayoutDashboard,
  Mic,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";

type NavigationItem = {
  label: string;
  icon: LucideIcon;
} & ({ available: true; href: string } | { available: false });

const navigation: NavigationItem[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/", available: true },
  { label: "Speech Studio", icon: Mic, href: "/studio", available: true },
  { label: "Model Lab", icon: AudioLines, available: false },
  { label: "Experiments", icon: FlaskConical, available: false },
  { label: "Datasets", icon: Database, available: false },
  { label: "Translation & TTS", icon: Languages, available: false },
  { label: "History", icon: History, available: false },
  { label: "Settings", icon: Settings, available: false },
];

function NavigationItems({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  return (
    <ul className={compact ? "flex w-max gap-2" : "space-y-1"}>
      {navigation.map((item) => {
        const Icon = item.icon;
        const isCurrent =
          item.available &&
          (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));

        return (
          <li key={item.label}>
            {item.available ? (
              <Link
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isCurrent
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                } ${
                  compact ? "min-h-10" : ""
                }`}
              >
                <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                <span>{item.label}</span>
              </Link>
            ) : (
              <div
                aria-disabled="true"
                title={`${item.label} will be available in a later phase.`}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground/80 ${
                  compact ? "min-h-10 border border-border/70 bg-card/60" : ""
                }`}
              >
                <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
                <span
                  className={`text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 ${
                    compact ? "ml-1" : "ml-auto"
                  }`}
                >
                  {compact ? "Soon" : "Planned"}
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function StudioShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[268px] flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <Link href="/" className="mb-9 flex items-center gap-3 px-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
            <AudioLines aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-wide text-foreground">
              KasaSpeech
            </span>
            <span className="block text-xs text-muted-foreground">AI Studio</span>
          </span>
        </Link>

        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Workspace
        </p>
        <nav aria-label="Main navigation">
          <NavigationItems />
        </nav>

        <div className="mt-auto rounded-2xl border border-border/80 bg-card/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Activity aria-hidden="true" className="size-4 text-sky-300" />
            <span>Platform status</span>
          </div>
          <Badge
            variant="outline"
            className="border-amber-300/25 bg-amber-300/10 text-amber-200"
          >
            Frontend only
          </Badge>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Inference and data services are not connected in this phase.
          </p>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[268px]">
        <header className="sticky top-0 z-10 border-b border-border/70 bg-background/90 backdrop-blur-xl">
          <div className="flex h-[68px] items-center justify-between gap-4 px-4 sm:px-7">
            <Link href="/" className="flex items-center gap-2.5 lg:hidden">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <AudioLines aria-hidden="true" className="size-[18px]" />
              </span>
              <span className="text-sm font-semibold">KasaSpeech AI Studio</span>
            </Link>
            <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
              <span>Workspace</span>
              <span aria-hidden="true" className="text-border">
                /
              </span>
              <span className="font-medium text-foreground">Overview</span>
            </div>
            <div className="ml-auto flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-300" />
              Backend not connected
            </div>
          </div>
          <nav
            aria-label="Mobile navigation"
            className="overflow-x-auto border-t border-border/50 px-4 py-2.5 lg:hidden"
          >
            <NavigationItems compact />
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
