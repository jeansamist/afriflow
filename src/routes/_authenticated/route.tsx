import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { VoiceProvider, IncomingCallOverlay } from "@/components/VoiceProvider";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "signin" } });

    // Redirect new users to phone onboarding (once per session, skips if already there)
    if (!location.pathname.startsWith("/onboarding")) {
      const sessionKey = `onboarding_checked_${data.user.id}`;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, "1");
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone_onboarding_completed, allocated_phone_number")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profile && !(profile as any).phone_onboarding_completed && !(profile as any).allocated_phone_number) {
          throw redirect({ to: "/onboarding/phone" });
        }
      }
    }

    return { user: data.user };
  },
  component: () => (
    <VoiceProvider>
      <Outlet />
      <IncomingCallOverlay />
    </VoiceProvider>
  ),
});
