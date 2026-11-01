/**
 * Funciones del panel administrativo.
 * Verifican el rol de administradora en el servidor antes de cualquier acceso.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !isAdmin) throw new Error("No autorizado");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function flattenLead(r: any) {
  const res = r?.assessment_sessions?.assessment_results;
  return { ...r, assessment_results: Array.isArray(res) ? (res[0] ?? null) : (res ?? null) };
}

export interface AdminFilters {
  from?: string | undefined;
  to?: string | undefined;
  situation?: string | undefined;
  country?: string | undefined;
  level?: string | undefined;
  vulnerability?: string | undefined;
  codeStage?: string | undefined;
  classification?: string | undefined;
  source?: string | undefined;
  search?: string | undefined;
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AdminFilters) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: rows, error } = await admin
      .from("leads")
      .select(
        `id, name, email, whatsapp, country, goal, commercial, classification, commercial_status,
         pdf_downloads, created_at,
         assessment_sessions(id, situation, experience_range, goal_12m, status, utm, started_at, completed_at, expires_at,
           assessment_results(overall_index, level, dimension_scores, alerts, code_stage, diagnosis_code, top_dimensions, strength, interpretation))`,
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const { data: sessions } = await admin
      .from("assessment_sessions")
      .select("id, status, utm, started_at, expires_at")
      .order("started_at", { ascending: false })
      .limit(1000);
    const { data: events } = await admin
      .from("commercial_events")
      .select("event_type, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    const { data: settingsRows } = await admin.from("app_settings").select("key, value");

    const allRows = ((rows ?? []) as any[]).map(flattenLead);
    let list = allRows;
    const f = data ?? {};
    const fFrom = f.from;
    if (fFrom) list = list.filter((r) => r.created_at >= fFrom);
    if (f.to) list = list.filter((r) => r.created_at <= `${f.to}T23:59:59Z`);
    if (f.situation) list = list.filter((r) => r.assessment_sessions?.situation === f.situation);
    if (f.country) list = list.filter((r) => (r.country ?? "").toLowerCase() === (f.country ?? "").toLowerCase());
    if (f.level) list = list.filter((r) => r.assessment_results?.level === f.level);
    if (f.vulnerability) list = list.filter((r) => (r.assessment_results?.top_dimensions ?? []).includes(f.vulnerability));
    if (f.codeStage) list = list.filter((r) => r.assessment_results?.code_stage === f.codeStage);
    if (f.classification) list = list.filter((r) => r.classification === f.classification);
    if (f.source) list = list.filter((r) => r.assessment_sessions?.utm?.utm_source === f.source);
    if (f.search) {
      const q = f.search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.name ?? "").toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q),
      );
    }

    const eventCount = (type: string) => (events ?? []).filter((e: any) => e.event_type === type).length;
    const prices = ((settingsRows ?? []).find((s: any) => s.key === "precios")?.value ?? {
      mentor_1a1_usd: 7500,
      mentoria_grupal_usd: 1200,
    }) as { mentor_1a1_usd?: number; mentoria_grupal_usd?: number };
    const sales = list.filter((r) => r.commercial_status === "cliente");
    const revenue = sales.reduce((acc, r) => {
      if (r.classification === "prospecto_1a1") return acc + (prices.mentor_1a1_usd ?? 7500);
      if (r.classification === "mentorias_grupal") return acc + (prices.mentoria_grupal_usd ?? 1200);
      return acc;
    }, 0);

    const metrics = {
      sessionsStarted: (sessions ?? []).length,
      sessionsCompleted: (sessions ?? []).filter((s: any) => s.status === "completada").length,
      completionRate:
        (sessions ?? []).length > 0
          ? Math.round(((sessions ?? []).filter((s: any) => s.status === "completada").length / (sessions ?? []).length) * 100)
          : 0,
      pdfDownloads: list.reduce((acc, r) => acc + (r.pdf_downloads ?? 0), 0),
      whatsappClicks: eventCount("clic_whatsapp"),
      qualifiedLeads: list.length,
      meetings: eventCount("reunion_registrada"),
      sales: sales.length,
      revenue,
      byClassification: {
        prospecto_1a1: list.filter((r) => r.classification === "prospecto_1a1").length,
        mentorias_grupal: list.filter((r) => r.classification === "mentorias_grupal").length,
        nutrir_contenidos: list.filter((r) => r.classification === "nutrir_contenidos").length,
        sin_intencion_comercial: list.filter((r) => r.classification === "sin_intencion_comercial").length,
      },
    };

    return { metrics, rows: list, settings: settingsRows ?? [] };
  });

export const getLeadDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { data: lead, error } = await admin
      .from("leads")
      .select(
        `*, assessment_sessions(id, situation, experience_range, goal_12m, status, utm, started_at, completed_at, expires_at, token,
           assessment_results(*), commercial_events(event_type, metadata, created_at)), admin_notes(*)`,
      )
      .eq("id", data.leadId)
      .single();
    if (error) throw new Error(error.message);
    const flat = flattenLead(lead);
    flat.commercial_events = flat.assessment_sessions?.commercial_events ?? [];
    const sessionId = (lead as any).assessment_sessions?.id;
    let answers: Record<string, number> = {};
    if (sessionId) {
      const { data: ans } = await admin
        .from("assessment_answers")
        .select("question_number, answer")
        .eq("session_id", sessionId);
      answers = Object.fromEntries((ans ?? []).map((a: any) => [a.question_number, a.answer]));
    }
    return { lead: flat, answers };
  });

export const updateLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; status: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { error } = await admin.from("leads").update({ commercial_status: data.status }).eq("id", data.leadId);
    if (error) throw new Error(error.message);
    if (data.status === "reunion_agendada" || data.status === "cliente") {
      const { data: lead } = await admin.from("leads").select("session_id").eq("id", data.leadId).single();
      if (lead) {
        await admin.from("commercial_events").insert({
          session_id: (lead as any).session_id,
          event_type: data.status === "cliente" ? "venta_registrada" : "reunion_registrada",
        });
      }
    }
    return { ok: true };
  });

export const addAdminNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; body: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { error } = await admin.from("admin_notes").insert({ lead_id: data.leadId, author_id: context.userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; value: unknown }) => input)
  .handler(async ({ data, context }) => {
    const admin = await requireAdmin(context);
    const { error } = await admin.from("app_settings").upsert({ key: data.key, value: data.value as any, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
