import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  CircleDollarSign,
  Phone,
  ShieldCheck,
  TimerReset,
  Sparkles,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/utils/notifications.functions";

type N = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link_to: string | null;
  read_at: string | null;
  created_at: string;
};

const ICONS: Record<string, { icon: any; tone: string }> = {
  PAYMENT_PAID: { icon: CircleDollarSign, tone: "text-success" },
  PAYOUT_SENT: { icon: CircleDollarSign, tone: "text-success" },
  PAYOUT_FAILED: { icon: AlertCircle, tone: "text-destructive" },
  NUMBER_ACTIVATED: { icon: Phone, tone: "text-primary" },
  LOW_MINUTES: { icon: TimerReset, tone: "text-amber-500" },
  TRIAL_EXPIRING: { icon: TimerReset, tone: "text-amber-500" },
  KYC_UPDATE: { icon: ShieldCheck, tone: "text-primary" },
  PRO_ACTIVATED: { icon: Sparkles, tone: "text-primary" },
  ADMIN_ALERT: { icon: AlertCircle, tone: "text-destructive" },
};

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export function NotificationBell() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyNotifications);
  const markFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });

  const markMut = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAllMut = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Realtime — refresh as new notifications arrive
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      channel = supabase
        .channel(`notif-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "in_app_notifications",
            filter: `user_id=eq.${uid}`,
          },
          () => qc.invalidateQueries({ queryKey: ["notifications"] }),
        )
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  const items = (q.data?.items ?? []) as N[];
  const unread = q.data?.unread ?? 0;
  const hasItems = items.length > 0;

  const badge = useMemo(() => (unread > 9 ? "9+" : String(unread)), [unread]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {badge}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(90vw,360px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button
              onClick={() => markAllMut.mutate()}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3 w-3" /> Tout marquer lu
            </button>
          )}
        </div>
        {!hasItems ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <Bell className="mx-auto h-5 w-5 opacity-50" />
            <p className="mt-2">Aucune notification pour l'instant.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <ul className="divide-y divide-border/60">
              {items.map((n) => {
                const cfg = ICONS[n.kind] ?? { icon: Bell, tone: "text-foreground" };
                const Icon = cfg.icon;
                const Wrapper: any = n.link_to ? Link : "div";
                const wrapperProps: any = n.link_to ? { to: n.link_to } : {};
                return (
                  <li
                    key={n.id}
                    className={`group px-3 py-3 transition ${n.read_at ? "" : "bg-primary/5"}`}
                  >
                    <Wrapper
                      {...wrapperProps}
                      onClick={() => !n.read_at && markMut.mutate(n.id)}
                      className="flex items-start gap-3"
                    >
                      <span className={`mt-0.5 ${cfg.tone}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight">{n.title}</p>
                        {n.body && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                        )}
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {relative(n.created_at)}
                        </p>
                      </div>
                      {!n.read_at && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                      )}
                    </Wrapper>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
