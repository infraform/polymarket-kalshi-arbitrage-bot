/**
 * User-friendly error handling and graceful shutdown.
 * Maps technical errors to clear messages and ensures clean exit (e.g. release lock).
 */

/**
 * Convert known errors into a short, actionable message.
 * Returns null if the error should be shown as-is.
 */
export function getFriendlyErrorMessage(err: unknown): string | null {
  if (!(err instanceof Error)) return null;

  const code = (err as NodeJS.ErrnoException & { code?: string }).code;
  const reason = (err as { reason?: string }).reason;
  const msg = err.message ?? "";

  // OpenSSL / RSA private key format issues
  if (
    code === "ERR_OSSL_UNSUPPORTED" ||
    reason === "unsupported" ||
    msg.includes("DECODER routines::unsupported")
  ) {
    return (
      "Kalshi private key format error.\n\n" +
      "Your KALSHI_PRIVATE_KEY_PATH or KALSHI_PRIVATE_KEY_PEM could not be used for signing.\n\n" +
      "Common causes:\n" +
      "  • Key must be RSA in PKCS#1 format (starts with '-----BEGIN RSA PRIVATE KEY-----')\n" +
      "  • If using PKCS#8 ('-----BEGIN PRIVATE KEY-----'), convert it:\n" +
      "    openssl rsa -in key.pem -out rsa_key.pem\n" +
      "  • Ensure .env has no extra spaces or line breaks in the PEM\n" +
      "  • Use KALSHI_PRIVATE_KEY_PEM with the full PEM string in .env (no file path)"
    );
  }

  // Generic crypto/decoder errors
  if (msg.includes("crypto") || msg.includes("decoder") || msg.includes("PEM")) {
    return (
      "Private key could not be read. Check that KALSHI_PRIVATE_KEY_PATH or KALSHI_PRIVATE_KEY_PEM\n" +
      "points to a valid RSA private key file. See .env.sample for format."
    );
  }

  // Network / connection
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    msg.toLowerCase().includes("network") ||
    msg.toLowerCase().includes("fetch")
  ) {
    return `Connection error: ${msg}\n\nCheck your network and that Kalshi/Polymarket APIs are reachable.`;
  }

  // Auth / 401 / 403
  if (msg.includes("401") || msg.includes("403") || msg.includes("Unauthorized") || msg.includes("Forbidden")) {
    return (
      "Authentication failed. Your Kalshi API key or private key may be invalid.\n" +
      "Verify KALSHI_API_KEY and your private key in .env."
    );
  }

  return null;
}

/**
 * Log a user-friendly error and optionally the raw error.
 * Uses stderr for the main message, and prints stack only when DEBUG=1.
 */
export function logFriendlyError(err: unknown, context?: string): void {
  const friendly = getFriendlyErrorMessage(err);
  const debug = process.env.DEBUG === "1" || process.env.DEBUG === "true";

  const prefix = context ? `[${context}] ` : "";

  if (friendly) {
    console.error("\n" + "─".repeat(60));
    console.error((prefix ? prefix + "\n" : "") + friendly);
    if (!debug) console.error("\nTip: Run with DEBUG=1 for full stack trace.");
    console.error("─".repeat(60) + "\n");
  } else {
    console.error("\n" + "─".repeat(60));
    console.error(prefix + "Error:", err instanceof Error ? err.message : String(err));
    console.error("─".repeat(60) + "\n");
  }

  if (debug && err instanceof Error && err.stack) {
    console.error("Stack trace:\n" + err.stack + "\n");
  } else if (!debug && !friendly) {
    console.error("Tip: Run with DEBUG=1 for full stack trace.\n");
  }
}

export type ExitCleanup = () => void;

/**
 * Gracefully exit after an error: log a friendly message, run cleanup, then exit(1).
 */
export function gracefulExit(err: unknown, cleanup?: ExitCleanup, context?: string): never {
  logFriendlyError(err, context);
  try {
    cleanup?.();
  } catch (cleanupErr) {
    console.error("Cleanup error:", cleanupErr);
  }
  process.exit(1);
}
