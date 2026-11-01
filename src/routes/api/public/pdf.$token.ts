import { createFileRoute } from "@tanstack/react-router";
import { publishableClient } from "@/lib/api/supabase-public.server";
import { buildReportPdf, type ReportPayload } from "@/lib/api/pdf.server";
import type { AnswerMap } from "@/lib/diagnostic/scoring";

/**
 * Descarga del informe ejecutivo PDF.
 * Ruta pública autenticada por el token seguro de la sesión (no por sesión de usuario):
 * el token es aleatorio, no predecible y tiene caducidad de 7 días.
 */
export const Route = createFileRoute("/api/public/pdf/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!/^[A-Za-z0-9_-]{20,120}$/.test(token)) {
          return new Response("Solicitud inválida", { status: 400 });
        }
        const supabase = publishableClient();
        const { data, error } = await supabase.rpc("get_assessment_result", { p_token: token });
        if (error || !data) {
          return new Response("El informe no está disponible o ya expiró", { status: 404 });
        }
        const { data: state } = await supabase.rpc("get_assessment_state", { p_token: token });
        const payload = data as unknown as ReportPayload;
        const answers = ((state as unknown as { answers: Record<string, number> } | null)?.answers ??
          {}) as AnswerMap;
        try {
          const bytes = await buildReportPdf(payload, answers);
          await supabase.rpc("increment_pdf_downloads", { p_token: token });
          await supabase.rpc("log_commercial_event", {
            p_token: token,
            p_type: "informe_descargado",
            p_meta: null,
          });
          const code = payload.diagnosis_code ?? "informe";
          return new Response(new Uint8Array(bytes) as unknown as BodyInit, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="mapa-expansion-profesional-${code}.pdf"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (err) {
          console.error("Error generando PDF", err);
          return new Response("No se pudo generar el informe", { status: 500 });
        }
      },
    },
  },
});
