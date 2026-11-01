import { Button } from "@/components/ui/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import logo from "@/assets/logo_tiby.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso · Mapa de Expansión Profesional" },
      { name: "description", content: "Acceso al panel administrativo." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Acceso · Mapa de Expansión Profesional" },
      { property: "og:description", content: "Acceso privado al panel de Tiby Hernández." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : err.message);
        return;
      }
      navigate({ to: "/admin", replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full max-w-sm">
        <img src={logo.url} alt="Tiby Hernández" className="mb-8 h-10 w-auto" />
        <h1 className="font-display text-2xl">Panel administrativo</h1>
        <p className="mt-2 text-sm text-muted-foreground">Acceso exclusivo para la administradora.</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico"
            autoComplete="email"
            className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary"
          />
          {error && <p className="text-sm text-accent">{error}</p>}
          <Button variant="ghost"
            type="submit"
            disabled={loading}
            className="h-auto min-w-0 whitespace-normal leading-relaxed w-full rounded-full bg-primary px-8 py-3.5 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a href="/" className="hover:text-foreground">
            Volver al sitio público
          </a>
        </p>
      </div>
    </main>
  );
}
