import { Link } from "@tanstack/react-router";
import { Phone } from "lucide-react";

/**
 * Floating action button — bottom-right WhatsApp-style entry point
 * that takes the user straight to the softphone.
 */
export function PhoneFab({ disabled }: { disabled?: boolean }) {
  if (disabled) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 group">
      {/* pulsing halo */}
      <span className="absolute inset-0 -z-10 rounded-full bg-emerald-500/50 animate-ping" />
      <span className="absolute -inset-1 -z-10 rounded-full bg-emerald-500/20 blur-md" />
      <Link
        to="/phone"
        aria-label="Passer un appel"
        className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white shadow-elevated shadow-emerald-500/40 ring-4 ring-emerald-500/20 transition-transform hover:scale-110 active:scale-95"
      >
        <Phone className="h-6 w-6" />
      </Link>
      <span className="pointer-events-none absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground/90 px-2.5 py-1 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
        Appeler un client
      </span>
    </div>
  );
}
