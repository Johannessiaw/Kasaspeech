"use client";

import Link from "next/link";
import {
  Activity,
  AudioLines,
  Bot,
  ChartNoAxesCombined,
  CircleHelp,
  Clock3,
  Languages,
  LayoutDashboard,
  Mic,
  Settings2,
  SlidersHorizontal,
  Volume2,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { applyStoredTheme } from "@/lib/user-preferences";

const navigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "ASR Studio", href: "/studio", icon: Mic },
  { label: "Translator", href: "/translate", icon: Languages },
  { label: "Text to speech", href: "/tts", icon: Volume2 },
  { label: "Live translate", href: "/live-translate", icon: Waves },
  { label: "AI assistant", href: "/assistant", icon: Bot },
  { label: "API integrations", href: "/integrations", icon: SlidersHorizontal },
  { label: "Model manager", href: "/models", icon: AudioLines },
  { label: "History", href: "/asr", icon: Clock3 },
  { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
  { label: "Settings", href: "/settings", icon: Settings2 },
];

function NavigationItems({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  return (
    <ul className={compact ? "flex w-max gap-1.5" : "space-y-1"}>
      {navigation.map(({ label, href, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${
                active
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_8px_24px_-12px_rgba(27,119,255,.9)]"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              } ${compact ? "min-h-10 whitespace-nowrap border border-white/[0.06]" : ""}`}
            >
              <Icon aria-hidden="true" className="size-[17px] shrink-0" />
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
      <li>
        <Link
          href="/help"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white ${
            compact ? "min-h-10 whitespace-nowrap border border-white/[0.06]" : ""
          }`}
        >
          <CircleHelp aria-hidden="true" className="size-[17px] shrink-0" />
          <span>Help & documentation</span>
        </Link>
      </li>
    </ul>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-[0_6px_26px_-10px_rgba(34,188,255,.9)]">
        <AudioLines aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold tracking-[0.11em] text-white">
          LINGUA <span className="text-cyan-300">AI</span>
        </span>
        {!compact && (
          <span className="mt-0.5 block text-[10px] tracking-wide text-slate-400">
            Speak. Listen. Translate.
          </span>
        )}
      </span>
    </Link>
  );
}

export function StudioShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useEffect(() => applyStoredTheme(), []);
  const currentPage =
    navigation.find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
    )?.label ?? "Help & documentation";

  return (
    <div className="min-h-screen bg-[#06132e] text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-white/[0.07] bg-[#071631] px-4 py-6 lg:flex">
        <div className="mb-9 px-2">
          <Brand />
        </div>
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Workspace
        </p>
        <nav aria-label="Main navigation">
          <NavigationItems />
        </nav>
        <div className="mt-auto rounded-2xl border border-white/[0.08] bg-[#0a1c3d] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Activity aria-hidden="true" className="size-4 text-cyan-300" />
            Service status
          </div>
          <p className="text-[11px] leading-5 text-slate-400">
            KasaSpeech transcription is available when its hosted Space is
            online. Other providers are configured separately.
          </p>
          <Link
            href="/integrations"
            className="mt-3 inline-flex text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Manage providers <span className="ml-1" aria-hidden="true">→</span>
          </Link>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[252px]">
        <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#06132e]/90 backdrop-blur-xl">
          <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 sm:px-7">
            <div className="lg:hidden">
              <Brand compact />
            </div>
            <div className="hidden items-center gap-2 text-xs text-slate-500 lg:flex">
              <span>Workspace</span>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-slate-200">{currentPage}</span>
            </div>
            <p className="hidden text-xs text-slate-400 md:block">
              Break Language Barriers with AI
            </p>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-[11px] text-slate-300 sm:flex">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                KasaSpeech
              </span>
              <Link
                href="/settings"
                aria-label="Open settings"
                className="flex size-9 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.035] text-slate-300 transition hover:border-cyan-300/30 hover:text-white"
              >
                <Settings2 aria-hidden="true" className="size-4" />
              </Link>
              <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-semibold text-white">
                LA
              </div>
            </div>
          </div>
          <nav
            aria-label="Mobile navigation"
            className="overflow-x-auto border-t border-white/[0.06] px-4 py-2.5 lg:hidden"
          >
            <NavigationItems compact />
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1560px] px-4 py-6 sm:px-7 sm:py-8 xl:px-9">
          {children}
          <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/[0.07] py-6 text-[11px] text-slate-500">
            <span>LINGUA AI</span>
            <Link href="/help" className="hover:text-slate-300">Documentation</Link>
            <Link href="/integrations" className="hover:text-slate-300">API integrations</Link>
            <Link href="/settings" className="hover:text-slate-300">Privacy & settings</Link>
            <span>Break Language Barriers with AI</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
