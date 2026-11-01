import { Button } from "@/components/ui/button";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import logo from "@/assets/logo_tiby.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdminOverview,
  getLeadDetail,
  updateLeadStatus,
  addAdminNote,
  updateSettings,
  type AdminFilters,
} from "@/lib/api/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel administrativo · Tiby Hernández" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Gestión privada de diagnósticos y prospectos de Tiby Hernández." },
      { property: "og:title", content: "Panel administrativo · Tiby Hernández" },
      { property: "og:description", content: "Gestión privada de diagnósticos y prospectos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: () => getAdminOverview({ data: {} }),
  component: AdminPanel,
});

const STATUS_OPTIONS = [
  { value: "nuevo", label: "Nuevo" },
  { value: "diagnostico_completado", label: "Diagnóstico completado" },
  { value: "interesado", label: "Interesado" },
  { value: "contactado", label: "Contactado" },
  { value: "reunion_agendada", label: "Reunión agendada" },
  { value: "propuesta_enviada", label: "Propuesta enviada" },
  { value: "cliente", label: "Cliente" },
  { value: "no_interesado", label: "No interesado" },
];

const CLASSIFICATION_LABELS: Record<string, string> = {
  prospecto_1a1: "Prospecto prioritario 1:1",
  mentorias_grupal: "Prospecto de mentoría grupal",
  nutrir_contenidos: "Nutrir con contenidos",
  sin_intencion_comercial: "Sin intención comercial inmediata",
};

const DIM_LABELS: Record<string, string> = {
  exposicion_financiera: "Exposición financiera",
  dependencia_operativa: "Dependencia operativa",
  capitalizacion_conocimiento: "Capitalización del conocimiento",
  adaptacion_profesional: "Adaptación profesional y tecnológica",
  preparacion_expansion: "Preparación para la expansión",
};

function AdminPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const initial = Route.useLoaderData() as {
    metrics: Record<string, any>;
    rows: any[];
    settings: { key: string; value: any }[];
  };
  const overview = useServerFn(getAdminOverview);
  const detail = useServerFn(getLeadDetail);
  const updateStatus = useServerFn(updateLeadStatus);
  const note = useServerFn(addAdminNote);
  const saveSettings = useServerFn(updateSettings);

  const [filters, setFilters] = useState<AdminFilters>({});
  const [rows, setRows] = useState<any[]>(initial.rows);
  const [metrics, setMetrics] = useState(initial.metrics);
  const [selected, setSelected] = useState<any | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [saving, setSaving] = useState(false);

  const settingsMap = Object.fromEntries(initial.settings.map((s) => [s.key, s.value]));
  const [price1a1, setPrice1a1] = useState(String(settingsMap.precios?.mentor_1a1_usd ?? 7500));
  const [priceGroup, setPriceGroup] = useState(String(settingsMap.precios?.mentoria_grupal_usd ?? 1200));

  useEffect(() => {
    setRows(initial.rows);
    setMetrics(initial.metrics);
  }, [initial]);

  const applyFilters = async (next: AdminFilters) => {
    setFilters(next);
    setSaving(true);
    try {
      const res = (await overview({ data: next })) as { metrics: any; rows: any[]; settings: any[] };
      setRows(res.rows);
      setMetrics(res.metrics);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (row: any) => {
    setSelected(row);
    setDetailData(null);
    try {
      const res = await detail({ data: { leadId: row.id } });
      setDetailData(res);
    } catch (e) {
      console.error(e);
    }
  };

  const changeStatus = async (leadId: string, status: string) => {
    await updateStatus({ data: { leadId, status } });
    setRows((prev) => prev.map((r) => (r.id === leadId ? { ...r, commercial_status: status } : r)));
    router.invalidate();
  };

  const addNote = async () => {
    if (!detailData || !noteBody.trim()) return;
    await note({ data: { leadId: selected.id, body: noteBody.trim() } });
    setNoteBody("");
    const res = await detail({ data: { leadId: selected.id } });
    setDetailData(res);
  };

  const savePrices = async () => {
    await saveSettings({
      data: { key: "precios", value: { mentor_1a1_usd: Number(price1a1), mentoria_grupal_usd: Number(priceGroup) } },
    });
    router.invalidate();
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  const exportCsv = () => {
    const header = [
      "nombre", "correo", "whatsapp", "pais", "fecha", "indice", "nivel", "etapa_code",
      "situacion", "clasificacion", "estado_comercial", "descargas_pdf", "codigo_diagnostico",
    ];
    const lines = rows.map((r) =>
      [
        r.name, r.email, r.whatsapp ?? "", r.country ?? "", r.created_at?.slice(0, 10),
        r.assessment_results?.overall_index ?? "", r.assessment_results?.level ?? "",
        r.assessment_results?.code_stage ?? "", r.assessment_sessions?.situation ?? "",
        r.classification ?? "", r.commercial_status, r.pdf_downloads ?? 0,
        r.assessment_results?.diagnosis_code ?? "",
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospectos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const metricCards: { label: string; value: string | number }[] = [
    { label: "Diagnósticos iniciados", value: metrics.sessionsStarted },
    { label: "Diagnósticos completados", value: metrics.sessionsCompleted },
    { label: "Tasa de finalización", value: `${metrics.completionRate}%` },
    { label: "Descargas de PDF", value: metrics.pdfDownloads },
    { label: "Clics hacia WhatsApp", value: metrics.whatsappClicks },
    { label: "Prospectos calificados", value: metrics.qualifiedLeads },
    { label: "Reuniones registradas", value: metrics.meetings },
    { label: "Ventas registradas", value: metrics.sales },
    { label: "Ingresos atribuidos (USD)", value: metrics.revenue.toLocaleString("en-US") },
  ];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between px-4 sm:px-6 py-4">
          <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
            <img src={logo.url} alt="Tiby Hernández" className="h-8 w-auto" />
            <span className="text-sm font-medium">Panel administrativo</span>
          </div>
          <Button variant="ghost" onClick={signOut} className="h-auto min-w-0 whitespace-normal leading-relaxed text-xs text-muted-foreground uppercase tracking-widest hover:text-foreground">
            Cerrar sesión
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <h1 className="font-display text-2xl">Indicadores</h1>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {metricCards.map((m) => (
            <div key={m.label} className="rounded-xl border border-border bg-card p-4">
              <p className="font-display text-2xl">{m.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-4">
          {Object.entries(metrics.byClassification ?? {}).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{CLASSIFICATION_LABELS[k] ?? k}</p>
              <p className="font-display mt-1 text-xl">{v as number}</p>
            </div>
          ))}
          <div className="rounded-xl border border-primary/40 bg-card p-4">
            <p className="text-xs text-muted-foreground">Ofertas de referencia</p>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <input value={price1a1} onChange={(e) => setPrice1a1(e.target.value)} className="min-w-0 w-full rounded border border-input bg-background px-2 py-1 text-sm" />
              <span className="text-xs text-muted-foreground">USD 1:1</span>
              <input value={priceGroup} onChange={(e) => setPriceGroup(e.target.value)} className="min-w-0 w-full rounded border border-input bg-background px-2 py-1 text-sm" />
              <span className="text-xs text-muted-foreground">USD grupal</span>
              <Button variant="ghost" onClick={savePrices} className="h-auto min-w-0 whitespace-normal leading-relaxed rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Guardar
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <h1 className="font-display col-span-full text-2xl">Prospectos</h1>
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => applyFilters({ ...filters, from: e.target.value })}
            className="min-w-0 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => applyFilters({ ...filters, to: e.target.value })}
            className="min-w-0 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          />
          <select
            value={filters.situation ?? ""}
            onChange={(e) => applyFilters({ ...filters, situation: e.target.value || undefined })}
            className="min-w-0 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          >
            <option value="">Situación (todas)</option>
            {["Empleado o ejecutivo", "Consultor independiente", "Especialista que trabaja por cuenta propia", "Mentor, formador o asesor", "Empresario o propietario de negocio", "Profesional en transición"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filters.level ?? ""}
            onChange={(e) => applyFilters({ ...filters, level: e.target.value || undefined })}
            className="min-w-0 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          >
            <option value="">Nivel (todos)</option>
            {["Baja", "Moderada", "Alta", "Crítica"].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select
            value={filters.codeStage ?? ""}
            onChange={(e) => applyFilters({ ...filters, codeStage: e.target.value || undefined })}
            className="min-w-0 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          >
            <option value="">Etapa CODE (todas)</option>
            {["Convertir", "Ordenar", "Digitalizar", "Escalar"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filters.classification ?? ""}
            onChange={(e) => applyFilters({ ...filters, classification: e.target.value || undefined })}
            className="min-w-0 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          >
            <option value="">Intención (todas)</option>
            {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            value={filters.search ?? ""}
            onChange={(e) => applyFilters({ ...filters, search: e.target.value || undefined })}
            placeholder="Buscar nombre o correo"
            className="min-w-0 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          />
          <Button variant="ghost" onClick={exportCsv} className="h-auto min-w-0 whitespace-normal leading-relaxed rounded-full border border-border px-5 py-2 text-sm hover:bg-secondary">
            Exportar CSV
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Índice</th>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3">Etapa CODE</th>
                <th className="px-4 py-3">Clasificación</th>
                <th className="px-4 py-3">Estado comercial</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    {saving ? "Cargando…" : "Aún no hay prospectos. Los datos de demostración se separan de los reales."}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-card/60">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{r.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3 font-display text-lg">{r.assessment_results?.overall_index ?? "—"}</td>
                  <td className="px-4 py-3">{r.assessment_results?.level ?? "—"}</td>
                  <td className="px-4 py-3">{r.assessment_results?.code_stage ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{CLASSIFICATION_LABELS[r.classification] ?? "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={r.commercial_status}
                      onChange={(e) => changeStatus(r.id, e.target.value)}
                      className="rounded border border-input bg-card px-2 py-1 text-xs"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" onClick={() => openDetail(r)} className="h-auto min-w-0 whitespace-normal leading-relaxed rounded-full border border-border px-4 py-1.5 text-xs hover:bg-secondary">
                      Ver ficha
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4" onClick={() => setSelected(null)}>
          <div
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {!detailData ? (
              <p className="text-sm text-muted-foreground">Cargando ficha…</p>
            ) : (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div>
                    <h2 className="font-display text-2xl">{detailData.lead.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {detailData.lead.email} {detailData.lead.whatsapp ? `· ${detailData.lead.whatsapp}` : ""}
                      {detailData.lead.country ? ` · ${detailData.lead.country}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => setSelected(null)} className="h-auto min-w-0 whitespace-normal leading-relaxed text-muted-foreground hover:text-foreground">✕</Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <Stat label="Índice" value={detailData.lead.assessment_results?.overall_index ?? "—"} />
                  <Stat label="Nivel" value={detailData.lead.assessment_results?.level ?? "—"} />
                  <Stat label="Etapa CODE" value={detailData.lead.assessment_results?.code_stage ?? "—"} />
                  <Stat label="Código" value={detailData.lead.assessment_results?.diagnosis_code ?? "—"} />
                </div>
                <div className="mt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Perfil</h3>
                  <p className="mt-1 text-sm">
                    {detailData.lead.assessment_sessions?.situation} · {detailData.lead.assessment_sessions?.experience_range} ·{" "}
                    {detailData.lead.assessment_sessions?.goal_12m}
                    {detailData.lead.assessment_sessions?.utm?.utm_source ? ` · Origen: ${detailData.lead.assessment_sessions.utm.utm_source}` : ""}
                  </p>
                </div>
                <div className="mt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Dimensiones</h3>
                  <div className="mt-2 space-y-2">
                    {(detailData.lead.assessment_results?.dimension_scores ?? []).map((d: any) => (
                      <div key={d.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm sm:flex sm:gap-3">
                        <span className="col-span-2 min-w-0 text-muted-foreground sm:col-span-1 sm:w-56">{DIM_LABELS[d.key] ?? d.label}</span>
                        <div className="h-2 flex-1 rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${d.score}%` }} />
                        </div>
                        <span className="w-8 text-right font-medium">{d.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {(detailData.lead.assessment_results?.alerts ?? []).length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-accent">Alertas</h3>
                    {(detailData.lead.assessment_results.alerts as any[]).map((a) => (
                      <p key={a.key} className="mt-1 text-sm text-muted-foreground">
                        <span className="text-accent">·</span> {a.title}
                      </p>
                    ))}
                  </div>
                )}
                <div className="mt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Respuestas (1–12)</h3>
                  <p className="mt-1 text-sm">{Object.entries(detailData.answers ?? {}).sort(([a], [b]) => Number(a) - Number(b)).map(([q, v]) => `${q}:${v}`).join(" · ") || "—"}</p>
                </div>
                {detailData.lead.commercial && (
                  <div className="mt-5">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Intención comercial</h3>
                    <p className="mt-1 text-sm">
                      {[detailData.lead.commercial.timing, detailData.lead.commercial.modality, detailData.lead.commercial.investment]
                        .filter(Boolean)
                        .join(" · ") || "Respondió sin interés por ahora"}
                    </p>
                  </div>
                )}
                <div className="mt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Historial</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(detailData.lead.commercial_events ?? [])
                      .map((e: any) => `${e.created_at?.slice(0, 10)}: ${e.event_type}`)
                      .join(" · ") || "Sin eventos registrados"}
                  </p>
                </div>
                <div className="mt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notas privadas</h3>
                  <div className="mt-2 space-y-1">
                    {(detailData.lead.admin_notes ?? []).map((n: any) => (
                      <p key={n.id} className="rounded bg-background px-3 py-2 text-sm">
                        {n.body} <span className="text-xs text-muted-foreground">({n.created_at?.slice(0, 10)})</span>
                      </p>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      placeholder="Añadir nota privada…"
                      className="min-w-0 flex-1 rounded border border-input bg-background px-3 py-2 text-sm"
                    />
                    <Button variant="ghost" onClick={addNote} className="h-auto min-w-0 whitespace-normal leading-relaxed rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                      Añadir
                    </Button>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:flex sm:items-center">
                  <span className="text-xs text-muted-foreground">Estado comercial:</span>
                  <select
                    value={detailData.lead.commercial_status}
                    onChange={(e) => {
                      changeStatus(detailData.lead.id, e.target.value);
                      setDetailData({ ...detailData, lead: { ...detailData.lead, commercial_status: e.target.value } });
                    }}
                    className="rounded border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display mt-0.5 break-words text-lg">{value}</p>
    </div>
  );
}
