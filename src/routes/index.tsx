import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import logo from "@/assets/logo_tiby.png.asset.json";

export const WHATSAPP_URL = "https://wa.link/k12c08";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mapa de Expansión Profesional · Tiby Hernández" },
      {
        name: "description",
        content:
          "Descubre el nivel de vulnerabilidad de tu modelo actual y las oportunidades que tienes para convertir tu experiencia en nuevas fuentes de ingresos.",
      },
      { property: "og:title", content: "Mapa de Expansión Profesional · Tiby Hernández" },
      {
        property: "og:description",
        content:
          "Diagnóstico gratuito: descubre qué tan dependiente es tu futuro profesional y cuál es tu ruta de expansión.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const DISCOVERIES = [
  { title: "Tu nivel de criticidad", text: "Un índice de 0 a 100 que muestra qué tan expuesto está tu modelo actual." },
  { title: "Mapa estratégico", text: "Tus cinco dimensiones de dependencia, visualizadas y explicadas." },
  { title: "Ruta de expansión CODE", text: "La etapa de entrada prioritaria para tu transformación." },
  { title: "Informe ejecutivo PDF", text: "Un documento de 6 páginas con tu plan de acción de 30 días." },
];

const CODE = [
  { letter: "C", title: "Convertir", text: "Tu experiencia en una oferta comprable" },
  { letter: "O", title: "Ordenar", text: "Cliente, oferta, precios y modelo de negocio" },
  { letter: "D", title: "Digitalizar", text: "Tecnología e IA en procesos prioritarios" },
  { letter: "E", title: "Escalar", text: "Captación, ventas y crecimiento" },
];

function Index() {
  const pageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    page.querySelectorAll(".home-reveal").forEach((element) => {
      // Keep already-visible content readable from the first frame.
      if (element.getBoundingClientRect().top < window.innerHeight) return;
      element.classList.add("reveal-ready");
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <main ref={pageRef} className="diagnostic-home min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-5">
        <img src={logo.url} alt="Tiby Hernández" className="h-10 w-auto" />
      </header>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-20 md:pt-20">
        <p className="home-enter home-enter-first mb-6 inline-block max-w-full rounded-full border border-primary/40 px-4 py-1.5 text-xs leading-relaxed tracking-normal text-primary uppercase sm:tracking-widest">
          Diagnóstico gratuito · 12 preguntas · 4 a 6 minutos
        </p>
        <h1 className="home-enter home-enter-title font-display max-w-3xl text-3xl leading-tight font-semibold sm:text-4xl md:text-6xl">
          ¿Qué tan dependiente es tu futuro profesional?
        </h1>
        <p className="home-enter home-enter-copy mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Has construido una trayectoria, acumulado conocimientos y desarrollado experiencia. Ahora descubre cuánto
          depende tu futuro de tu modelo actual y qué oportunidades tienes para expandirlo.
        </p>
        <div className="home-enter home-enter-actions mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/diagnostico"
            className="home-primary-action inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Descubrir mi nivel de criticidad
          </Link>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-border px-8 py-4 font-medium text-foreground transition hover:bg-secondary"
          >
            Escríbeme por WhatsApp
          </a>
        </div>
      </section>

      <section className="home-reveal hairline bg-card py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-2xl md:text-3xl">Lo que descubrirás</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {DISCOVERIES.map((d, i) => (
              <div key={d.title} className="border-l border-border pl-5">
                <span className="font-display text-sm text-primary">0{i + 1}</span>
                <h3 className="mt-2 font-medium">{d.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-reveal py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-2xl md:text-3xl">La metodología detrás de tu mapa</h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Tu diagnóstico se interpreta con la metodología CODE de Tiby Hernández: cuatro etapas de transformación que
            estructuran tu ruta de expansión.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CODE.map((c) => (
              <div key={c.letter} className="home-code-item rounded-xl border border-border bg-card p-6">
                <span className="font-display text-3xl text-accent">{c.letter}</span>
                <h3 className="mt-3 font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-reveal hairline border-t border-border bg-card py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
          <h2 className="font-display text-2xl md:text-4xl">Tu siguiente etapa merece una estrategia</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
            Resultado personalizado, mapa de criticidad y ruta de expansión. Sin costo, sin datos financieros
            sensibles, sin compromiso.
          </p>
          <Link
            to="/diagnostico"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Descubrir mi nivel de criticidad
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:px-6 py-10 text-xs text-muted-foreground sm:flex-row">
        <span>© 2026 Tiby Hernández · Mapa de Expansión Profesional</span>
        <div className="flex gap-6">
          <Link to="/privacidad" className="transition hover:text-foreground">
            Política de privacidad
          </Link>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="transition hover:text-foreground">
            WhatsApp
          </a>
        </div>
      </footer>
    </main>
  );
}
