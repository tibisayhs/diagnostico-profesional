import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Layout protegido: exige sesión válida antes de montar cualquier ruta hija.
 * Solo la administradora autorizada accede a los datos del panel.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
