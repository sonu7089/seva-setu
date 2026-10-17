"use client";

import * as React from "react";
import {
  CalendarClock,
  ClipboardList,
  Database,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GemmaProviderStatus, WorkspaceTab } from "@/types/sevasetu";

interface NavbarProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  readyVisitsCount: number;
  pendingDaysCount: number;
  gemmaStatus: GemmaProviderStatus | null;
  dbReady: boolean;
  onToggleDiagnostics: () => void;
  diagnosticsOpen: boolean;
}

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  step: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "previsit",
    step: "1",
    label: "Pre-Visit Bay",
    sublabel: "Patient / Nurse",
    icon: ClipboardList,
  },
  {
    id: "doctor",
    step: "2",
    label: "Doctor Console",
    sublabel: "SOAP Briefs",
    icon: Stethoscope,
  },
  {
    id: "postvisit",
    step: "3",
    label: "Post-Visit Prescription & Calendar",
    sublabel: "Rx Scan & Schedule",
    icon: CalendarClock,
  },
];

export function Navbar({
  activeTab,
  onTabChange,
  readyVisitsCount,
  pendingDaysCount,
  gemmaStatus,
  dbReady,
  onToggleDiagnostics,
  diagnosticsOpen,
}: NavbarProps) {
  const [logoError, setLogoError] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-2.5">
        {/* Brand + Logo Slot */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* SevaSetu Brand Logo (/public/logo.png) */}
            <div
              className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-white p-0.5 shadow-sm"
              title="SevaSetu (सेवासेतु)"
            >
              {!logoError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/logo.png"
                  alt="SevaSetu Logo"
                  className="h-full w-full object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="font-devanagari text-sm font-semibold tracking-tight text-primary">
                  सेवा
                </span>
              )}
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-semibold tracking-tight text-foreground">
                  SevaSetu
                </span>
                <span className="font-devanagari text-sm font-medium text-muted-foreground">
                  सेवासेतु
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Outpatient Intake &amp; Prescription Bridge
              </p>
            </div>
          </div>

          {/* Mobile system status button */}
          <button
            type="button"
            onClick={onToggleDiagnostics}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                dbReady ? "bg-emerald-600" : "bg-amber-500"
              )}
            />
            System
          </button>
        </div>

        {/* Center Navigation Switcher */}
        <nav
          aria-label="Clinical workflow navigation"
          className="flex items-center gap-1 overflow-x-auto rounded-lg border bg-muted/60 p-1"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                  isActive
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold tabular-nums",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-border/70 text-muted-foreground"
                  )}
                >
                  {item.step}
                </span>
                <Icon className="hidden h-3.5 w-3.5 shrink-0 sm:inline-block" />
                <span>{item.label}</span>

                {item.id === "doctor" && readyVisitsCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-0.5 h-5 px-1.5 text-[11px] tabular-nums"
                  >
                    {readyVisitsCount}
                  </Badge>
                )}

                {item.id === "postvisit" && pendingDaysCount > 0 && (
                  <Badge
                    variant="warning"
                    className="ml-0.5 h-5 px-1.5 text-[11px] tabular-nums"
                  >
                    {pendingDaysCount}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right System Status Indicator */}
        <div className="hidden items-center gap-2 lg:flex">
          <button
            type="button"
            onClick={onToggleDiagnostics}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              diagnosticsOpen
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Database className="h-3.5 w-3.5 text-primary" />
            <span>SQLite WAL</span>
            <span className="text-border">·</span>
            <span className="text-foreground">
              {gemmaStatus?.activeProvider === "digitalocean_gradient"
                ? "DO Gradient · Gemma 4"
                : gemmaStatus?.activeProvider === "google_ai_studio"
                  ? "Gemma 4 API"
                  : gemmaStatus?.activeProvider === "ollama_local"
                    ? "Gemma 4 Ollama"
                    : "Gemma 4 Ready"}
            </span>
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                dbReady ? "bg-emerald-600" : "bg-amber-500"
              )}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
