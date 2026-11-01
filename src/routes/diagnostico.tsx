import { Button } from "@/components/ui/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import logo from "@/assets/logo_tiby.png.asset.json";
import {
  SITUATIONS,
  EXPERIENCE_RANGES,
  GOALS_12M,
  QUESTIONS,
  questionBlockIntro,
  BLOCK_LABELS,
} from "@/lib/diagnostic/questions";
import { computeDiagnosticFull, type AnswerMap } from "@/lib/diagnostic/scoring";
import {
  startAssessment,
  getAssessmentState,
  saveAssessmentAnswer,
  saveAssessmentResult,
} from "@/lib/api/public.functions";

export const Route = createFileRoute("/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico · Mapa de Expansión Profesional" },
      { name: "description", content: "12 preguntas para medir la dependencia de tu modelo profesional actual." },
      { property: "og:title", content: "Diagnóstico · Mapa de Expansión Profesional" },
      { property: "og:description", content: "12 preguntas para medir la dependencia de tu modelo profesional actual." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Diagnostico,
});

const TOKEN_KEY = "mep_session_token";

type Phase = "perfil" | "resume" | "quiz" | "calculando";

function Diagnostico() {
  const navigate = useNavigate();
  const start = useServerFn(startAssessment);
  const getState = useServerFn(getAssessmentState);
  const saveAnswer = useServerFn(saveAssessmentAnswer);
  const saveResult = useServerFn(saveAssessmentResult);

  const [phase, setPhase] = useState<Phase>("perfil");
  const [situation, setSituation] = useState("");
  const [experience, setExperience] = useState("");
  const [goal, setGoal] = useState("");
  const [token, setToken] = useState("");
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState("");

  // Recuperar sesión previa (respuestas válidas durante 7 días).
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) return;
    getState({ data: { token: saved } })
      .then((state) => {
        if (!state) {
          localStorage.removeItem(TOKEN_KEY);
          return;
        }
        const parsed = Object.fromEntries(
          Object.entries(state.answers ?? {}).map(([k, v]) => [Number(k), v]),
        ) as AnswerMap;
        setSituation(state.situation);
        setExperience(state.experience_range);
        setGoal(state.goal_12m);
        setToken(saved);
        if (state.status === "completada") {
          navigate({ to: "/resultado/$token", params: { token: saved }, replace: true });
        } else if (Object.keys(parsed).length > 0) {
          setAnswers(parsed);
          setPhase("resume");
        }
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginQuiz = async () => {
    setError("");
    let t = token;
    try {
      if (!t) {
        const params = new URLSearchParams(window.location.search);
        const utm: Record<string, string> = {};
        for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
          const v = params.get(key);
          if (v) utm[key] = v;
        }
        const res = await start({
          data: { situation, experienceRange: experience, goal12m: goal, utm },
        });
        t = res.token;
        localStorage.setItem(TOKEN_KEY, t);
        setToken(t);
      }
      setPhase("quiz");
    } catch (e) {
      setError("No pudimos iniciar tu diagnóstico. Revisa tu conexión e inténtalo de nuevo.");
      console.error(e);
    }
  };

  const choose = (questionNumber: number, score: 0 | 1 | 2 | 3) => {
    setAnswers((prev) => ({ ...prev, [questionNumber]: score }));
    if (token) {
      saveAnswer({ data: { token, question: questionNumber, answer: score } }).catch((e) => console.error(e));
    }
  };

  const next = () => {
    if (answers[QUESTIONS[idx].number] === undefined) return;
    if (idx === QUESTIONS.length - 1) {
      void finish();
    } else {
      setIdx(idx + 1);
    }
  };

  const prev = () => {
    if (idx > 0) setIdx(idx - 1);
    else setPhase("perfil");
  };

  const finish = async () => {
    setPhase("calculando");
    try {
      const result = computeDiagnosticFull(answers, situation, goal);
      const payload = {
        overall_index: result.overallIndex,
        level: result.level,
        dimension_scores: result.dimensionScores.map((d) => ({ key: d.key, label: d.label, score: d.score })),
        alerts: result.alerts,
        code_stage: result.codeStage,
        priority_actions: result.priorityActions,
        top_dimensions: result.topDimensions,
        strength: result.strength,
        interpretation: result.interpretation,
      };
      await saveResult({ data: { token, result: payload } });
      setTimeout(() => {
        navigate({ to: "/resultado/$token", params: { token }, replace: true });
      }, 900);
    } catch (e) {
      console.error(e);
      setError("No pudimos guardar tu diagnóstico. Inténtalo de nuevo.");
      setPhase("quiz");
    }
  };

  // Navegación por teclado.
  useEffect(() => {
    if (phase !== "quiz") return;
    const handler = (e: KeyboardEvent) => {
      const q = QUESTIONS[idx];
      if (["1", "2", "3", "4"].includes(e.key)) {
        const score = (Number(e.key) - 1) as 0 | 1 | 2 | 3;
        choose(q.number, score);
      } else if (e.key === "ArrowRight") {
        next();
      } else if (e.key === "ArrowLeft") {
        prev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, answers]);

  const answeredCount = Object.keys(answers).length;
  const progress = phase === "quiz" ? (idx / QUESTIONS.length) * 100 : phase === "calculando" ? 100 : 0;

  if (phase === "calculando") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 sm:px-6 text-center">
        <img src={logo.url} alt="Tiby Hernández" className="h-12 w-auto opacity-80" />
        <div className="h-1 w-48 overflow-hidden rounded-full bg-secondary">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
        <p className="font-display text-xl">Calculando tu mapa de expansión…</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Estamos cruzando tus respuestas con las cinco dimensiones de criticidad y la ruta CODE.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between px-4 sm:px-6 py-4">
          <img src={logo.url} alt="Tiby Hernández" className="h-8 w-auto max-w-full" />
          <span className="max-w-32 text-right text-xs leading-relaxed tracking-normal text-muted-foreground uppercase sm:max-w-none sm:tracking-widest">
            {phase === "quiz" ? `Pregunta ${idx + 1} de 12` : "Perfil profesional"}
          </span>
        </div>
        <div className="h-1 bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${Math.max(progress, phase === "quiz" ? (idx / 12) * 100 : 0)}%` }}
          />
        </div>
      </header>

      {phase === "perfil" && (
        <section className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
          <h1 className="font-display text-3xl md:text-4xl">Tu perfil profesional</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Tres preguntas para contextualizar tu diagnóstico. No solicitamos datos financieros exactos ni información
            innecesariamente sensible.
          </p>

          <ProfileGroup
            label="Situación profesional actual"
            options={SITUATIONS}
            value={situation}
            onChange={setSituation}
          />
          <ProfileGroup label="Años de experiencia profesional" options={EXPERIENCE_RANGES} value={experience} onChange={setExperience} />
          <ProfileGroup
            label="Principal objetivo para los próximos 12 meses"
            options={GOALS_12M}
            value={goal}
            onChange={setGoal}
          />

          {error && <p className="mt-6 text-sm text-accent">{error}</p>}

          <Button variant="ghost"
            onClick={beginQuiz}
            disabled={!situation || !experience || !goal}
            className="h-auto min-w-0 whitespace-normal leading-relaxed mt-10 w-full rounded-full bg-primary px-8 py-4 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            Comenzar el diagnóstico
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            12 preguntas · 4 a 6 minutos · tus respuestas se guardan automáticamente.
          </p>
        </section>
      )}

      {phase === "resume" && (
        <section className="mx-auto max-w-3xl px-4 sm:px-6 py-14 text-center">
          <h1 className="font-display text-3xl">Bienvenida de nuevo</h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
            Recuperamos tu diagnóstico del {new Date().toLocaleDateString("es-CO")}. Llevas {answeredCount} de 12
            preguntas respondidas y puedes continuar donde lo dejaste.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button variant="ghost"
              onClick={() => setPhase("quiz")}
              className="h-auto min-w-0 whitespace-normal leading-relaxed rounded-full bg-primary px-8 py-4 font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Continuar mi diagnóstico
            </Button>
            <Button variant="ghost"
              onClick={() => {
                localStorage.removeItem(TOKEN_KEY);
                setToken("");
                setAnswers({});
                setSituation("");
                setExperience("");
                setGoal("");
                setPhase("perfil");
              }}
              className="h-auto min-w-0 whitespace-normal leading-relaxed rounded-full border border-border px-8 py-4 font-medium transition hover:bg-secondary"
            >
              Empezar de nuevo
            </Button>
          </div>
        </section>
      )}

      {phase === "quiz" && (
        <section className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
          {(() => {
            const q = QUESTIONS[idx];
            const intro = questionBlockIntro(q.number, situation);
            const selected = answers[q.number];
            return (
              <>
                {intro && (
                  <div className="mb-6 rounded-xl border border-border bg-card p-4">
                    <span className="text-[10px] tracking-widest text-primary uppercase">{BLOCK_LABELS[q.block]}</span>
                    <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
                  </div>
                )}
                <h2 className="font-display text-2xl leading-snug md:text-3xl">{q.text}</h2>
                <p className="mt-2 text-xs text-muted-foreground">Selecciona una opción (obligatoria)</p>
                <div className="mt-8 flex flex-col gap-3">
                  {q.options.map((opt, i) => (
                    <Button variant="ghost"
                      key={i}
                      onClick={() => choose(q.number, opt.score)}
                      className={`h-auto min-w-0 whitespace-normal leading-relaxed rounded-xl border px-5 py-4 text-left transition ${
                        selected === opt.score
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <span className="h-auto min-w-0 whitespace-normal leading-relaxed mr-3 font-display text-sm text-primary">{i + 1}</span>
                      {opt.label}
                    </Button>
                  ))}
                </div>
                <div className="mt-10 grid grid-cols-2 items-stretch gap-3 sm:flex sm:justify-between">
                  <Button variant="ghost"
                    onClick={prev}
                    className="h-auto min-w-0 whitespace-normal leading-relaxed rounded-full border border-border px-4 sm:px-6 py-3 text-sm transition hover:bg-secondary"
                  >
                    Anterior
                  </Button>
                  <Button variant="ghost"
                    onClick={next}
                    disabled={selected === undefined}
                    className="h-auto min-w-0 whitespace-normal leading-relaxed rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {idx === QUESTIONS.length - 1 ? "Ver mi resultado" : "Siguiente"}
                  </Button>
                </div>
                <p className="mt-6 text-xs text-muted-foreground">
                  Atajos: teclas 1–4 para responder, ← y → para navegar.
                </p>
              </>
            );
          })()}
        </section>
      )}
    </main>
  );
}

function ProfileGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-10">
      <h3 className="text-sm font-medium tracking-wide text-foreground">{label}</h3>
      <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
        {options.map((opt) => (
          <Button variant="ghost"
            key={opt}
            onClick={() => onChange(opt)}
            className={`h-auto min-w-0 whitespace-normal leading-relaxed rounded-full border px-4 py-2.5 text-sm transition ${
              value === opt ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/50"
            }`}
          >
            {opt}
          </Button>
        ))}
      </div>
    </div>
  );
}
