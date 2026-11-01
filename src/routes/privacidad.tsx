import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/logo_tiby.png.asset.json";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Política de privacidad · Tiby Hernández" },
      { name: "description", content: "Tratamiento de datos personales del diagnóstico Mapa de Expansión Profesional." },
      { property: "og:title", content: "Política de privacidad · Tiby Hernández" },
      { property: "og:description", content: "Tratamiento de datos del diagnóstico Mapa de Expansión Profesional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacidad,
});

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Qué datos recogemos",
    body: [
      "Solo recogemos los datos que nos proporcionas voluntariamente: tu situación profesional (en categorías), años de experiencia (en rangos) y tu objetivo para los próximos 12 meses, junto con tus respuestas al diagnóstico.",
      "Si decides descargar el informe completo, recogemos además tu nombre, número de WhatsApp (opcional), país y tu principal objetivo de expansión.",
      "No solicitamos datos financieros exactos ni información innecesariamente sensible.",
    ],
  },
  {
    title: "Para qué los usamos",
    body: [
      "Para calcular tu diagnóstico, generar tu mapa de criticidad, tu ruta CODE y tu informe ejecutivo en PDF.",
      "Para permitirte recuperar tus respuestas durante siete días mediante un identificador de sesión seguro, sin exponer información personal.",
      "Para gestionar la conversación estratégica que solicites por WhatsApp, si decides hacerlo.",
    ],
  },
  {
    title: "Consentimientos",
    body: [
      "El consentimiento para el tratamiento de datos es necesario para gestionar tu diagnóstico y entregarte el informe. Se registra con fecha, versión de política y propósito.",
      "La autorización para comunicaciones comerciales es opcional y está desmarcada por defecto. Aceptarla no es requisito para descargar tu informe.",
    ],
  },
  {
    title: "Seguridad y acceso",
    body: [
      "Tus resultados se identifican con un token seguro y no predecible; los accesos a los resultados tienen caducidad de siete días.",
      "Los datos del panel administrativo nunca se exponen mediante consultas públicas. Solo la administradora autorizada puede consultar datos personales y reportes individuales.",
    ],
  },
  {
    title: "Tus derechos",
    body: [
      "Puedes solicitar la eliminación de tus datos escribiendo por WhatsApp al +57 313 465 4162, indicando el código de diagnóstico de tu informe.",
      "No utilizamos contadores de urgencia, testimonios inventados ni mensajes alarmistas.",
    ],
  },
];

function Privacidad() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 sm:px-6 py-5">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo.url} alt="Tiby Hernández" className="h-8 w-auto" />
        </Link>
        <Link to="/" className="text-xs tracking-widest text-muted-foreground uppercase transition hover:text-foreground">
          Volver
        </Link>
      </header>
      <article className="mx-auto max-w-3xl px-4 sm:px-6 pb-20">
        <h1 className="font-display text-3xl md:text-4xl">Política de privacidad</h1>
        <p className="mt-2 text-sm text-muted-foreground">Versión 2026-11-01 · Tratamiento de datos personales</p>
        {SECTIONS.map((s) => (
          <section key={s.title} className="mt-10">
            <h2 className="font-display text-xl">{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>
    </main>
  );
}
