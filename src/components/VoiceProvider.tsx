import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { PhoneCall, PhoneIncoming, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import type { Device, Call } from "@twilio/voice-sdk";

import { Button } from "@/components/ui/button";
import { getMyPhoneState, recordSimulatedCall } from "@/utils/telephony.functions";
import { getPhoneWallet, consumeCallMinutes } from "@/utils/wallet.functions";
import { getVoiceToken } from "@/utils/voice.functions";

export type CallStatus = "idle" | "dialing" | "ringing" | "in-call" | "ended" | "incoming";
export type DeviceStatus = "off" | "connecting" | "ready" | "error";
type Direction = "OUTBOUND" | "INBOUND";

type VoiceContextValue = {
  deviceStatus: DeviceStatus;
  status: CallStatus;
  elapsed: number;
  muted: boolean;
  incomingFrom: string | null;
  /** Dial an E.164 (or raw) number through the Twilio Device. */
  connect: (to: string, opts?: { clientId?: string | null }) => Promise<void>;
  hangUp: () => void;
  acceptIncoming: () => void;
  declineIncoming: () => void;
  toggleMute: () => void;
};

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used inside <VoiceProvider>");
  return ctx;
}

/** Classic dual-tone ring (440 + 480 Hz), 1s on / 2s off, via WebAudio. */
function useRinger() {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const burst = useCallback(() => {
    try {
      ctxRef.current ??= new AudioContext();
      const ctx = ctxRef.current;
      void ctx.resume().catch(() => {});
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.connect(ctx.destination);
      for (const freq of [440, 480]) {
        const osc = ctx.createOscillator();
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start();
        osc.stop(ctx.currentTime + 1);
      }
      setTimeout(() => gain.disconnect(), 1100);
    } catch {
      // Autoplay may be blocked before any user gesture — the visual overlay still shows.
    }
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) return;
    burst();
    intervalRef.current = setInterval(burst, 3000);
  }, [burst]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);
  return { start, stop };
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const fetchState = useServerFn(getMyPhoneState);
  const fetchWallet = useServerFn(getPhoneWallet);
  const fetchToken = useServerFn(getVoiceToken);
  const record = useServerFn(recordSimulatedCall);
  const consumeFn = useServerFn(consumeCallMinutes);

  const stateQ = useQuery({ queryKey: ["phone-state"], queryFn: () => fetchState() });
  const walletQ = useQuery({ queryKey: ["phone-wallet"], queryFn: () => fetchWallet() });
  const allocation = stateQ.data?.allocation;
  const minutesLeft = walletQ.data?.totalMinutesRemaining ?? 0;

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const outboundRef = useRef<{ to: string; clientId: string | null }>({ to: "", clientId: null });
  const minutesLeftRef = useRef(minutesLeft);
  minutesLeftRef.current = minutesLeft;

  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("off");
  const [status, setStatus] = useState<CallStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [incomingFrom, setIncomingFrom] = useState<string | null>(null);
  const ringer = useRinger();

  const recordMut = useMutation({
    mutationFn: (input: Parameters<typeof recordSimulatedCall>[0]["data"]) =>
      record({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["phone-state"] }),
    onError: (e: Error) => toast.error(`Journal : ${e.message}`),
  });

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const onCallEnd = useCallback(
    (
      direction: Direction,
      outcome: "completed" | "no-answer" | "busy" | "failed",
      from?: string | null,
    ) => {
      const duration =
        startedAtRef.current > 0 ? Math.floor((Date.now() - startedAtRef.current) / 1000) : 0;
      stopTimer();
      ringer.stop();
      startedAtRef.current = 0;
      setStatus("ended");
      callRef.current = null;

      recordMut.mutate({
        to: direction === "OUTBOUND" ? outboundRef.current.to : (from ?? ""),
        direction,
        durationSeconds: duration,
        outcome,
        clientId: direction === "OUTBOUND" ? outboundRef.current.clientId : null,
      });

      // Only outbound minutes are metered — incoming calls are unlimited.
      if (direction === "OUTBOUND" && outcome === "completed" && duration > 0) {
        consumeFn({ data: { seconds: duration } })
          .then(() => qc.invalidateQueries({ queryKey: ["phone-wallet"] }))
          .catch(() => {});
      }

      setTimeout(() => {
        setStatus("idle");
        setElapsed(0);
        setMuted(false);
        setIncomingFrom(null);
      }, 1200);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const wireCall = useCallback(
    (call: Call, direction: Direction) => {
      callRef.current = call;
      const from = call.parameters?.From ?? null;

      call.on("accept", () => {
        ringer.stop();
        setStatus("in-call");
        startedAtRef.current = Date.now();
        timerRef.current = setInterval(() => {
          const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
          setElapsed(sec);
          if (direction === "OUTBOUND" && sec >= minutesLeftRef.current * 60) {
            toast.error("Crédits épuisés en cours d'appel.");
            call.disconnect();
          }
        }, 500);
      });

      call.on("ringing", () => setStatus("ringing"));
      call.on("disconnect", () => onCallEnd(direction, "completed", from));
      call.on("cancel", () => onCallEnd(direction, "no-answer", from));
      call.on("reject", () => onCallEnd(direction, "no-answer", from));
      call.on("error", (err) => {
        toast.error(`Erreur d'appel : ${err.message}`);
        onCallEnd(direction, "failed", from);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onCallEnd],
  );

  // ── Init Twilio Device (app-wide, once per allocated number) ───────────────
  useEffect(() => {
    if (!allocation) return;
    let mounted = true;

    (async () => {
      setDeviceStatus("connecting");
      try {
        const { token } = await fetchToken();
        if (!mounted) return;

        const { Device: TwilioDevice } = await import("@twilio/voice-sdk");
        const device = new TwilioDevice(token, { logLevel: "warn", edge: "roaming" });

        device.on("registered", () => {
          if (mounted) setDeviceStatus("ready");
        });
        device.on("unregistered", () => {
          if (mounted) setDeviceStatus("off");
        });
        device.on("error", (err) => {
          if (mounted) {
            setDeviceStatus("error");
            toast.error(`Device: ${err.message}`);
          }
        });

        device.on("incoming", (call: Call) => {
          if (!mounted) return;
          // Already busy → let the caller hear the no-answer fallback.
          if (callRef.current) {
            call.reject();
            return;
          }
          const from = call.parameters?.From ?? "Inconnu";
          setIncomingFrom(from);
          setStatus("incoming");
          wireCall(call, "INBOUND");
          ringer.start();
          toast.info(`Appel entrant · ${from}`, { duration: 10_000 });
        });

        device.on("tokenWillExpire", async () => {
          try {
            const { token: fresh } = await fetchToken();
            device.updateToken(fresh);
          } catch {
            /* silent */
          }
        });

        await device.register();
        if (mounted) deviceRef.current = device;
        else device.destroy();
      } catch (err) {
        if (mounted) {
          setDeviceStatus("error");
          toast.error(`Impossible d'initialiser la téléphonie : ${(err as Error).message}`);
        }
      }
    })();

    return () => {
      mounted = false;
      ringer.stop();
      deviceRef.current?.destroy();
      deviceRef.current = null;
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocation?.e164]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const connect = useCallback(
    async (to: string, opts?: { clientId?: string | null }) => {
      if (!allocation) throw new Error("Aucun numéro actif.");
      if (!deviceRef.current || deviceStatus !== "ready")
        throw new Error("Ligne non prête. Patientez…");

      outboundRef.current = { to: to.trim(), clientId: opts?.clientId ?? null };
      setStatus("dialing");
      setElapsed(0);
      try {
        const call = await deviceRef.current.connect({
          params: { To: to.trim(), callerId: allocation.e164 },
        });
        wireCall(call, "OUTBOUND");
      } catch (err) {
        setStatus("idle");
        throw err;
      }
    },
    [allocation, deviceStatus, wireCall],
  );

  const hangUp = useCallback(() => {
    if (callRef.current) callRef.current.disconnect();
    else onCallEnd("OUTBOUND", "no-answer");
  }, [onCallEnd]);

  const acceptIncoming = useCallback(() => {
    ringer.stop();
    callRef.current?.accept();
  }, [ringer]);

  const declineIncoming = useCallback(() => {
    ringer.stop();
    callRef.current?.reject();
  }, [ringer]);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    setMuted((m) => {
      callRef.current?.mute(!m);
      return !m;
    });
  }, []);

  const value = useMemo<VoiceContextValue>(
    () => ({
      deviceStatus,
      status,
      elapsed,
      muted,
      incomingFrom,
      connect,
      hangUp,
      acceptIncoming,
      declineIncoming,
      toggleMute,
    }),
    [
      deviceStatus,
      status,
      elapsed,
      muted,
      incomingFrom,
      connect,
      hangUp,
      acceptIncoming,
      declineIncoming,
      toggleMute,
    ],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

/**
 * App-wide incoming call banner: rings and lets the user answer from any page.
 * Also shows a compact in-call bar when a call is active outside /phone.
 */
export function IncomingCallOverlay() {
  const { status, incomingFrom, elapsed, acceptIncoming, declineIncoming, hangUp } = useVoice();
  const navigate = useNavigate();
  const location = useLocation();
  const onPhonePage = location.pathname === "/phone";

  if (status === "incoming") {
    return (
      <div className="fixed bottom-4 right-4 z-[100] w-80 rounded-2xl border border-primary/40 bg-surface p-4 shadow-elevated animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary animate-pulse">
            <PhoneIncoming className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Appel entrant</p>
            <p className="truncate font-mono text-sm text-muted-foreground">
              {incomingFrom ?? "Inconnu"}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button
            className="col-span-2 shadow-glow"
            onClick={() => {
              acceptIncoming();
              if (!onPhonePage) navigate({ to: "/phone" });
            }}
          >
            <PhoneCall className="h-4 w-4" /> Répondre
          </Button>
          <Button variant="destructive" onClick={declineIncoming}>
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (status === "in-call" && !onPhonePage) {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return (
      <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-3 rounded-full border border-primary/40 bg-surface px-4 py-2 shadow-elevated">
        <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
        <button
          className="font-mono text-sm hover:text-primary"
          onClick={() => navigate({ to: "/phone" })}
          title="Ouvrir la cabine"
        >
          {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </button>
        <Button size="sm" variant="destructive" className="h-7 rounded-full px-3" onClick={hangUp}>
          <PhoneOff className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return null;
}
