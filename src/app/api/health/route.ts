import { NextResponse } from "next/server";
import { getDatabaseDiagnostics, getDb } from "@/lib/db";
import { getGemmaProviderStatus } from "@/lib/gemma";

export const dynamic = "force-dynamic";

/**
 * Readiness probe for DigitalOcean App Platform (`.do/app.yaml` health_check)
 * and uptime monitors. Intentionally cheap: one `SELECT 1`, no AI call, so
 * probing never spends inference tokens. Never returns secrets — provider
 * status is booleans, model names, and hosts only.
 */
export async function GET() {
  const startedAt = Date.now();
  let dbOk = false;
  let journalMode = "unknown";
  let fileExists = false;
  let fileSizeBytes = 0;

  try {
    getDb().prepare("SELECT 1").get();
    const diagnostics = getDatabaseDiagnostics();
    journalMode = diagnostics.journalMode;
    fileExists = diagnostics.fileExists;
    fileSizeBytes = diagnostics.fileSizeBytes;
    dbOk = journalMode.toUpperCase() === "WAL";
  } catch {
    dbOk = false;
  }

  const gemma = getGemmaProviderStatus();
  const healthy = dbOk;

  return NextResponse.json(
    {
      ok: healthy,
      status: healthy ? "healthy" : "degraded",
      service: "sevasetu",
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      db: {
        ok: dbOk,
        journalMode,
        walHealthy: dbOk,
        fileExists,
        fileSizeBytes,
      },
      ai: {
        activeProvider: gemma.activeProvider,
        modelName: gemma.modelName,
        fallbackChain: gemma.fallbackChain,
        fallbackReady: gemma.fallbackReady,
        digitalOcean: gemma.digitalOcean,
        googleApiKeyConfigured: gemma.googleApiKeyConfigured,
        ollamaEndpointConfigured: gemma.ollamaEndpointConfigured,
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
