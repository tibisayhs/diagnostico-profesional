import { Button } from "@/components/ui/button";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import logo from "@/assets/logo_tiby.png.asset.json";
import {
  CODE_STAGES,
  dimensionVulnerability,
  type DimensionKey,
} from "@/lib/diagnostic/scoring";
import {
  saveLead,
  saveCommercialAnswers,
  logEvent,
  getAssessmentResult,
} from "@/lib/api/public.functions";
import { whatsappHref, buildDiagnosisMessage } from "@/lib/whatsapp";

export const Route = createFileRoute("/resultado/$token")({
  head: () => ({
    meta: [
      { title: "Tu mapa de expansión profesional · Tiby Hernández" },
      { name: "description", content: "Resultado personalizado del diagnóstico de criticidad profesional." },
      { property: "og:title", content: "Tu mapa de expansión profesional · Tiby Hernández" },
      { property: "og:description", content: "Resultado personalizado del diagnóstico de criticidad profesional." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ params }) => getAssessmentResult({ data: { token: params.token } }),
  errorComponent: () => (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 sm:px-6 text-center">
      <h1 className="font-display text-2xl">Este enlace de resultado no está disponible</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Los resultados tienen una caducidad de siete días por seguridad. Puedes realizar el diagnóstico nuevamente o
        escribir a Tiby por WhatsApp con tu código de diagnóstico.
      </p>
      <Link to="/" className="rounded-full bg-primary px-4 sm:px-6 py-3 text-sm font-semibold text-primary-foreground">
        Volver al inicio
      </Link>
    </main>
  ),
  component: Resultado,
});

interface ResultData {
  overall_index: number;
  level: string;
  dimension_scores: { key: string; label: string; score: number }[];
  alerts: { key: string; title: string; description: string }[];
  code_stage: string;
  priority_actions: { title: string; objective: string; activity: string; expected: string; indicator: string }[];
  top_dimensions: string[];
  strength: string;
  interpretation: string;
  diagnosis_code: string;
  situation: string;
  experience_range: string;
  goal_12m: string;
  completed_at: string;
  lead_name: string | null;
}

const TIMING = [
  { value: "inmediatamente", label: "Inmediatamente" },
  { value: "30_dias", label: "En los próximos 30 días" },
  { value: "90_dias", label: "En los próximos 90 días" },
  { value: "explorando", label: "Estoy explorando" },
];
const MODALITY = [
  { value: "individual", label: "Individual y personalizado" },
  { value: "grupal", label: "Grupal y estructurado" },
  { value: "orientacion", label: "Quiero orientación" },
];
const INVESTMENT = [
  { value: "premium", label: "Estoy preparado para invertir en un acompañamiento premium" },
  { value: "programa", label: "Contemplo invertir en un programa estructurado" },
  { value: "opciones", label: "Necesito conocer primero las opciones" },
  { value: "sin_inversion", label: "No tengo previsto invertir actualmente" },
];

function levelColor(level: string): "lime" | "orange" {
  return level === "Alta" || level === "Crítica" ? "orange" : "lime";
}

function Resultado() {
  const data = Route.useLoaderData() as ResultData;
  const token = Route.useParams().token;
  const navigate = useNavigate();
  const saveLeadFn = useServerFn(saveLead);
  const saveCommercialFn = useServerFn(saveCommercialAnswers);
  const logEventFn = useServerFn(logEvent);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [name, setName] = useState("");
  const email = "";
  const [whatsapp, setWhatsapp] = useState("");
  const [country, setCountry] = useState("");
  const [goal, setGoal] = useState(data.goal_12m ?? "");
  const [dataConsent, setDataConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [leadDone, setLeadDone] = useState(Boolean(data.lead_name));
  const [leadError, setLeadError] = useState("");
  const [savingLead, setSavingLead] = useState(false);

  const [wants, setWants] = useState("");
  const [timing, setTiming] = useState("");
  const [modality, setModality] = useState("");
  const [investment, setInvestment] = useState("");
  const [commercialDone, setCommercialDone] = useState(false);

  const radarData = data.dimension_scores.map((d) => ({
    dim: d.label.split(" ")[0],
    score: d.score,
  }));
  const sorted = [...data.dimension_scores].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 2);
  const strength = sorted[sorted.length - 1];
  const pdfHref = `/api/public/pdf/${token}`;
  const waMessage = useMemo(
    () =>
      buildDiagnosisMessage({
        levelLabel: data.level,
        topDimensionLabel: top[0].label,
        codeStage: data.code_stage,
        diagnosisCode: data.diagnosis_code,
      }),
    [data, top],
  );
  const waHref = whatsappHref(waMessage);

  const submitLead = async (e: FormEvent) => {
    e.preventDefault();
    setLeadError("");
    if (!dataConsent) {
      setLeadError("Necesitamos tu consentimiento para el tratamiento de datos.");
      return;
    }
    setSavingLead(true);
    try {
      await saveLeadFn({
        data: { token, name, email, whatsapp, country, goal, marketingConsent },
      });
      setLeadDone(true);
    } catch (err) {
      setLeadError("No pudimos registrar tus datos. Inténtalo de nuevo.");
      console.error(err);
    } finally {
      setSavingLead(false);
    }
  };

  const submitCommercial = async () => {
    try {
      await saveCommercialFn({
        data: { token, commercial: { wants: wants === "si" ? "si" : "no", timing, modality, investment } },
      });
      setCommercialDone(true);
    } catch (err) {
      console.error(err);
    }
  };

  const onWhatsAppClick = () => {
    logEventFn({ data: { token, type: "clic_whatsapp" } }).catch(() => {});
  };

  return (
    <main className="min-h-screen bg-background pb-32 md:pb-16">
      <header className="border-b border-border">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between px-4 sm:px-6 py-4">
          <img src={logo.url} alt="Tiby Hernández" className="h-8 w-auto max-w-full" />
          <span className="text-xs text-muted-foreground">Código {data.diagnosis_code}</span>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        <p className="text-xs tracking-widest text-primary uppercase">Tu mapa de expansión profesional</p>
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:gap-8">
          <div>
            <span className="font-display text-6xl sm:text-7xl md:text-8xl" style={{ color: levelColor(data.level) === "orange" ? "var(--color-accent)" : "var(--color-primary)" }}>
              {data.overall_index}
            </span>
            <span className="font-display text-2xl text-muted-foreground">/100</span>
          </div>
          <div>
            <p className="text-xs tracking-widest text-muted-foreground uppercase">Nivel de criticidad</p>
            <p className="font-display text-3xl" style={{ color: levelColor(data.level) === "orange" ? "var(--color-accent)" : "var(--color-primary)" }}>
              {data.level}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Emitido el {new Date(data.completed_at).toLocaleDateString("es-CO")}
            </p>
          </div>
        </div>
        <p className="mt-8 max-w-3xl text-base leading-relaxed text-muted-foreground">{data.interpretation}</p>
      </section>

      <section className="hairline bg-card py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="font-display text-2xl md:text-3xl">Mapa de criticidad</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Cuanto mayor sea la puntuación de una dimensión, mayor es su nivel de criticidad.
          </p>
          {/* Barras horizontales en móvil */}
          <div className="mt-10 md:hidden">
            {data.dimension_scores.map((d) => (
              <div key={d.key} className="mb-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-sm">
                  <span>{d.label}</span>
                  <span className="font-semibold">{d.score}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${d.score}%`,
                      background: d.score >= 66 ? "var(--color-accent)" : "var(--color-primary)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {/* Radar en escritorio */}
          {mounted && (
            <div className="mt-6 hidden h-[380px] md:block">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis dataKey="dim" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="score" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {top.map((d) => (
              <div key={d.key} className="rounded-xl border border-accent/40 bg-background p-5">
                <p className="text-xs tracking-widest text-accent uppercase">Área de mayor exposición</p>
                <h3 className="font-display mt-1 text-lg">{d.label}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{dimensionVulnerability(d.key as DimensionKey)}</p>
              </div>
            ))}
            <div className="rounded-xl border border-primary/40 bg-background p-5 sm:col-span-2">
              <p className="text-xs tracking-widest text-primary uppercase">Fortaleza relativa</p>
              <h3 className="font-display mt-1 text-lg">{strength.label}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Con {strength.score}/100, esta es tu dimensión con menor criticidad: la base sobre la que puedes apoyar
                tu transformación.
              </p>
            </div>
          </div>
          <div className="mt-10 rounded-xl border border-border bg-background p-6">
            <h3 className="font-display text-xl">Tu principal punto de vulnerabilidad</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {data.top_dimensions[0] === data.top_dimensions[1]
                ? dimensionVulnerability(data.top_dimensions[0] as DimensionKey)
                : `${top[0].label} (${top[0].score}/100) es tu dimensión más crítica: ${dimensionVulnerability(top[0].key as DimensionKey).toLowerCase()} Combinada con ${top[1].label.toLowerCase()} (${top[1].score}/100), concentra la mayor parte del riesgo de tu modelo actual.`}
            </p>
          </div>
        </div>
      </section>

      {data.alerts.length > 0 && (
        <section className="py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="font-display text-2xl md:text-3xl">Alertas relevantes</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Estas alertas se muestran aunque tu puntuación general sea moderada o baja.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {data.alerts.map((a) => (
                <div key={a.key} className="rounded-xl border-l-4 border-l-accent border border-border bg-card p-5">
                  <h3 className="font-semibold">{a.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="hairline border-t border-border bg-card py-14">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="font-display text-2xl md:text-3xl">Tu ruta CODE</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            El sistema identifica una etapa de entrada prioritaria según tu resultado; las demás son complementarias.
            No toda persona recorre las cuatro etapas de la misma forma.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CODE_STAGES.map((stage, i) => {
              const isEntry = stage.key === data.code_stage;
              return (
                <div key={stage.key} className="relative">
                  <div
                    className={`h-full rounded-xl border p-5 transition ${
                      isEntry
                        ? "border-primary bg-primary text-primary-foreground shadow-lg"
                        : "border-border bg-background"
                    }`}
                  >
                    {isEntry && (
                      <span className="mb-2 inline-block rounded-full border border-primary-foreground/40 px-2 py-0.5 text-[10px] tracking-widest uppercase">
                        Etapa de entrada
                      </span>
                    )}
                    <span className={`font-display text-3xl ${isEntry ? "" : "text-accent"}`}>{stage.letter}</span>
                    <h3 className="mt-2 font-semibold">{stage.title}</h3>
                    <p className={`mt-1 text-sm ${isEntry ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                      {stage.description}
                    </p>
                  </div>
                  {!isEntry && (
                    <span className="absolute -top-3 left-4 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] tracking-widest text-muted-foreground uppercase">
                      Complementaria
                    </span>
                  )}
                  {i < CODE_STAGES.length - 1 && (
                    <span className="pointer-events-none absolute top-1/2 -right-3 z-10 hidden -translate-y-1/2 font-display text-xl text-muted-foreground lg:block">
                      →
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <h3 className="font-display mt-14 text-xl">Tres acciones prioritarias para los próximos 30 días</h3>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {data.priority_actions.map((a, i) => (
              <div key={i} className="rounded-xl border border-border bg-background p-5">
                <span className="font-display text-sm text-primary">0{i + 1}</span>
                <h4 className="mt-1 font-semibold">{a.title}</h4>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs tracking-widest text-accent uppercase">Actividad</dt>
                    <dd className="text-muted-foreground">{a.activity}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-widest text-accent uppercase">Resultado esperado</dt>
                    <dd className="text-muted-foreground">{a.expected}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-widest text-accent uppercase">Indicador</dt>
                    <dd className="text-muted-foreground">{a.indicator}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            El índice de criticidad es una herramienta orientativa con umbrales iniciales; no constituye una escala
            científicamente validada ni una predicción sobre tu situación futura. Nunca presentamos predicciones de
            quiebra o desempleo como hechos.
          </p>
        </div>
      </section>

      {/* Captura de prospectos + descarga del informe */}
      <section id="informe" className="scroll-mt-6 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="font-display text-2xl md:text-3xl">Descarga tu informe ejecutivo</h2>
          {leadDone ? (
            <div className="mt-6">
              <p className="text-sm text-muted-foreground">
                Tu informe de 9 páginas está listo, {data.lead_name ?? name}. Incluye tu mapa de criticidad, el análisis
                de dependencia, tu escenario de continuidad, la ruta CODE y tu plan de acción de 30 días.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <a
                  href={pdfHref}
                  download
                  onClick={() => {}}
                  className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Descargar informe PDF
                </a>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onWhatsAppClick}
                  className="inline-flex items-center justify-center rounded-full border border-primary px-8 py-4 font-semibold text-primary transition hover:bg-primary/10"
                >
                  Quiero conversar sobre mi mapa de expansión
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={submitLead} className="mt-6 space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
              <p className="text-sm text-muted-foreground">
                Para generar tu informe completo necesitamos estos datos. La descarga no depende de aceptar
                comunicaciones comerciales.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre y apellido"
                  className="min-w-0 w-full rounded-lg border border-input bg-background px-4 py-3 text-base sm:text-sm outline-none focus:border-primary"
                />
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="WhatsApp (opcional)"
                  className="min-w-0 w-full rounded-lg border border-input bg-background px-4 py-3 text-base sm:text-sm outline-none focus:border-primary"
                />
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="País"
                  className="min-w-0 w-full rounded-lg border border-input bg-background px-4 py-3 text-base sm:text-sm outline-none focus:border-primary"
                />
              </div>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Principal objetivo de expansión"
                className="w-full min-w-0 w-full rounded-lg border border-input bg-background px-4 py-3 text-base sm:text-sm outline-none focus:border-primary"
              />
              <label className="flex items-start gap-3 text-xs leading-relaxed text-muted-foreground">
                <input
                  type="checkbox"
                  required
                  checked={dataConsent}
                  onChange={(e) => setDataConsent(e.target.checked)}
                  className="mt-0.5 accent-[var(--color-primary)]"
                />
                <span>
                  Autorizo el tratamiento de mis datos personales para gestionar mi diagnóstico y entregarme el informe
                  (consentimiento necesario). Consulta la{" "}
                  <Link to="/privacidad" className="underline">
                    política de privacidad
                  </Link>
                  . Puedes solicitar la eliminación de tus datos en cualquier momento.
                </span>
              </label>
              <label className="flex items-start gap-3 text-xs leading-relaxed text-muted-foreground">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 accent-[var(--color-primary)]"
                />
                <span>Acepto recibir comunicaciones comerciales de Tiby Hernández (opcional).</span>
              </label>
              {leadError && <p className="text-sm text-accent">{leadError}</p>}
              <Button variant="ghost"
                type="submit"
                disabled={savingLead}
                className="h-auto min-w-0 whitespace-normal leading-relaxed w-full rounded-full bg-primary px-8 py-4 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
              >
                {savingLead ? "Generando…" : "Generar mi informe PDF"}
              </Button>
            </form>
          )}

          {!leadDone && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onWhatsAppClick}
              className="mt-6 inline-flex items-center justify-center rounded-full border border-border px-8 py-4 font-medium transition hover:bg-secondary sm:hidden"
            >
              Quiero conversar por WhatsApp
            </a>
          )}
        </div>
      </section>

      {/* Calificación comercial opcional */}
      <section className="hairline border-t border-border bg-card py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="font-display text-2xl">¿Te gustaría explorar cómo implementar tu ruta de expansión?</h2>
          {commercialDone ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Gracias. Tus preferencias quedaron registradas y Tiby tendrá en cuenta tu modalidad e intención al
              conversar contigo.
            </p>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:flex">
                <Button variant="ghost"
                  onClick={() => setWants("si")}
                  className={`h-auto min-w-0 whitespace-normal leading-relaxed rounded-full border px-5 py-2.5 text-sm transition ${wants === "si" ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                >
                  Sí, me interesa
                </Button>
                <Button variant="ghost"
                  onClick={() => setWants("no")}
                  className={`h-auto min-w-0 whitespace-normal leading-relaxed rounded-full border px-5 py-2.5 text-sm transition ${wants === "no" ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                >
                  Por ahora no
                </Button>
              </div>
              {wants === "si" && (
                <div className="h-auto min-w-0 whitespace-normal leading-relaxed mt-8 space-y-6">
                  <RadioRow label="¿Cuándo deseas comenzar?" options={TIMING} value={timing} onChange={setTiming} />
                  <RadioRow label="¿Qué tipo de acompañamiento prefieres?" options={MODALITY} value={modality} onChange={setModality} />
                  <RadioRow label="¿Qué disposición de inversión tienes?" options={INVESTMENT} value={investment} onChange={setInvestment} />
                  <Button variant="ghost"
                    onClick={submitCommercial}
                    className="h-auto min-w-0 whitespace-normal leading-relaxed rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    Enviar mis preferencias
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Tus respuestas comerciales no modifican tu índice de criticidad; solo orientan el tipo de
                    acompañamiento que puede conversar contigo Tiby.
                  </p>
                </div>
              )}
              {wants === "no" && (
                <div className="mt-6">
                  <Button variant="ghost"
                    onClick={submitCommercial}
                    className="h-auto min-w-0 whitespace-normal leading-relaxed rounded-full border border-border px-8 py-3 text-sm transition hover:bg-secondary"
                  >
                    Registrar mi respuesta
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <footer className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 sm:px-6 py-10 text-xs text-muted-foreground sm:flex-row">
        <span>© 2026 Tiby Hernández · Código {data.diagnosis_code}</span>
        <div className="flex gap-6">
          <Link to="/privacidad" className="transition hover:text-foreground">
            Política de privacidad
          </Link>
          <Link to="/" className="transition hover:text-foreground">
            Inicio
          </Link>
        </div>
      </footer>

      {/* Barra móvil fija: descarga e invitación siempre visibles */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="grid grid-cols-2 gap-3">
          <a
            href={leadDone ? pdfHref : "#informe"}
            {...(leadDone ? { download: true } : {})}
            className="min-w-0 rounded-full bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground"
          >
            {leadDone ? "Informe PDF" : "Obtener informe"}
          </a>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onWhatsAppClick}
            className="min-w-0 rounded-full border border-primary px-4 py-3 text-center text-sm font-semibold text-primary"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}

function RadioRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <h4 className="text-sm font-medium">{label}</h4>
      <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap">
        {options.map((o) => (
          <Button variant="ghost"
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`h-auto min-w-0 whitespace-normal leading-relaxed rounded-full border px-4 py-2 text-xs transition ${
              value === o.value ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/50"
            }`}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
