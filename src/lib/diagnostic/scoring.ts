/**
 * Motor de criticidad — determinista, sin IA generativa.
 * Fuente: PROMPT MAESTRO, secciones 5, 6, 7 y 8.
 */
import { QUESTIONS, type SituationCategory, situationCategory } from "./questions";

export type AnswerMap = Record<number, 0 | 1 | 2 | 3>;

export type DimensionKey =
  | "exposicion_financiera"
  | "dependencia_operativa"
  | "capitalizacion_conocimiento"
  | "adaptacion_profesional"
  | "preparacion_expansion";

export interface DimensionDef {
  key: DimensionKey;
  label: string;
  short: string;
  questions: number[];
  weight: number;
}

export const DIMENSIONS: DimensionDef[] = [
  { key: "exposicion_financiera", label: "Exposición financiera", short: "Financiera", questions: [1, 2], weight: 0.25 },
  { key: "dependencia_operativa", label: "Dependencia operativa", short: "Operativa", questions: [3, 4, 5], weight: 0.25 },
  { key: "capitalizacion_conocimiento", label: "Capitalización del conocimiento", short: "Conocimiento", questions: [7, 8], weight: 0.2 },
  { key: "adaptacion_profesional", label: "Adaptación profesional y tecnológica", short: "Adaptación", questions: [10, 11], weight: 0.15 },
  { key: "preparacion_expansion", label: "Preparación para la expansión", short: "Expansión", questions: [6, 9, 12], weight: 0.15 },
];

export type Level = "Baja" | "Moderada" | "Alta" | "Crítica";

export function levelOf(index: number): Level {
  if (index <= 25) return "Baja";
  if (index <= 50) return "Moderada";
  if (index <= 75) return "Alta";
  return "Crítica";
}

export interface Alert {
  key: string;
  title: string;
  description: string;
}

export function computeAlerts(a: AnswerMap): Alert[] {
  const alerts: Alert[] = [];
  if (a[1] === 3) {
    alerts.push({
      key: "cobertura_financiera",
      title: "Baja cobertura financiera",
      description:
        "Indicaste que tus gastos esenciales se cubrirían por menos de un mes sin tus ingresos principales. Un fondo de continuidad es la primera prioridad de estabilidad, antes de cualquier expansión.",
    });
  }
  if (a[2] === 3) {
    alerts.push({
      key: "concentracion_ingresos",
      title: "Alta concentración de ingresos",
      description:
        "El 80% o más de tus ingresos proviene de una sola fuente. Toda tu continuidad depende de la decisión de una sola empresa, cliente o mercado.",
    });
  }
  if (a[3] === 3) {
    alerts.push({
      key: "dependencia_operativa",
      title: "Dependencia operativa significativa",
      description:
        "Tus ingresos prácticamente desaparecerían si dejaras de trabajar 30 días. La actividad genera valor solo mientras trabajas personalmente.",
    });
  }
  if (a[4] === 3 && a[5] === 3) {
    alerts.push({
      key: "modelo_horas",
      title: "Límite del modelo basado en horas",
      description:
        "Tus ingresos dependen por completo de tus horas y no tienes capacidad de crecer sin aumentar sustancialmente tu carga. El modelo llegó a su tope estructural.",
    });
  }
  if ((a[6] ?? 0) >= 2 && (a[7] ?? 0) >= 2 && (a[12] ?? 0) >= 2) {
    alerts.push({
      key: "preparacion_comercial",
      title: "Preparación comercial insuficiente",
      description:
        "Aún no has estructurado una oferta, ni validado alternativas, ni ejecutado acciones recientes para generar ingresos nuevos. La preparación comercial es el paso que abre todas las demás opciones.",
    });
  }
  return alerts;
}

export type CodeStage = "Convertir" | "Ordenar" | "Digitalizar" | "Escalar";

export interface StageInfo {
  key: CodeStage;
  letter: string;
  title: string;
  description: string;
}

export const CODE_STAGES: StageInfo[] = [
  { key: "Convertir", letter: "C", title: "Convertir", description: "Transformar experiencia en una propuesta de valor comercializable." },
  { key: "Ordenar", letter: "O", title: "Ordenar", description: "Definir cliente, oferta, precios y modelo de negocio." },
  { key: "Digitalizar", letter: "D", title: "Digitalizar", description: "Aplicar tecnología e inteligencia artificial a procesos prioritarios." },
  { key: "Escalar", letter: "E", title: "Escalar", description: "Desarrollar generación de oportunidades, ventas y capacidad de crecimiento." },
];

export function computeCodeStage(a: AnswerMap, dimensions: Record<DimensionKey, number>): CodeStage {
  // Regla 1: capitalización del conocimiento con alta criticidad → Convertir.
  if (dimensions.capitalizacion_conocimiento >= 60) return "Convertir";
  // Regla 2: existen ofertas pero falta estructura comercial → Ordenar.
  if ((a[7] === 1 || a[8] === 1) && dimensions.capitalizacion_conocimiento < 60) return "Ordenar";
  // Regla 3: procesos repetitivos y baja adopción tecnológica → Digitalizar.
  if ((a[10] ?? 0) >= 2 && (a[11] ?? 0) >= 2) return "Digitalizar";
  // Regla 4: oferta validada y estructura operativa, pero captación insuficiente → Escalar.
  if ((a[9] ?? 0) >= 2) return "Escalar";
  // Fallback: la dimensión más crítica define la entrada.
  const worst = DIMENSIONS.reduce((acc, d) => (dimensions[d.key] > dimensions[acc.key] ? d : acc));
  if (worst.key === "capitalizacion_conocimiento") return "Convertir";
  if (worst.key === "exposicion_financiera" || worst.key === "dependencia_operativa") return "Ordenar";
  if (worst.key === "adaptacion_profesional") return "Digitalizar";
  return "Escalar";
}

export interface DimensionScore {
  key: DimensionKey;
  label: string;
  score: number;
  weight: number;
}

export interface DiagnosticResult {
  overallIndex: number;
  level: Level;
  dimensionScores: DimensionScore[];
  alerts: Alert[];
  codeStage: CodeStage;
  priorityActions: PriorityAction[];
  topDimensions: DimensionKey[];
  strength: DimensionKey;
  interpretation: string;
}

export interface PriorityAction {
  title: string;
  objective: string;
  activity: string;
  expected: string;
  indicator: string;
}

const ACTIONS: Record<DimensionKey, PriorityAction[]> = {
  exposicion_financiera: [
    {
      title: "Construir tu colchón de continuidad",
      objective: "Reducir la vulnerabilidad ante la pérdida de tu fuente principal de ingresos.",
      activity: "Definir un monto mensual fijo destinado a un fondo de reserva y automatizarlo el día de cobro.",
      expected: "Un colchón que cubra gastos esenciales durante más tiempo sin depender de tu fuente principal.",
      indicator: "Meses de gastos esenciales cubiertos por el fondo.",
    },
    {
      title: "Diversificar la procedencia de tus ingresos",
      objective: "Disminuir la dependencia de una sola empresa, empleo o cliente.",
      activity: "Mapear tus tres fuentes actuales de ingreso y diseñar una acción concretada por trimestre para abrir una segunda fuente.",
      expected: "Un ingreso secundario activo, aunque sea inicialmente pequeño.",
      indicator: "Porcentaje de ingresos proveniente de la fuente principal.",
    },
    {
      title: "Estabilizar tu ingreso recurrente",
      objective: "Convertir ventas esporádicas en ingresos previsibles.",
      activity: "Convertir al menos un servicio o acuerdo actual en una modalidad recurrente (retainer, suscripción o contrato mensual).",
      expected: "Una base de ingreso recurrente establecida.",
      indicator: "Porcentaje de ingresos recurrentes.",
    },
  ],
  dependencia_operativa: [
    {
      title: "Desacoplar tu ingreso de tus horas",
      objective: "Que una parte de tus ingresos no dependa de tu presencia personal.",
      activity: "Elegir una entrega recurrente de tu trabajo y convertirla en una pieza documentada, delegable o automatizable.",
      expected: "Una actividad que hoy depende de ti, funcionando sin ti al menos parcialmente.",
      indicator: "Horas liberadas por semana y porcentaje de ingreso no ligado a tus horas.",
    },
    {
      title: "Sistematizar tu operación actual",
      objective: "Crear capacidad para crecer sin aumentar tu carga.",
      activity: "Documentar tus dos procesos más repetitivos y definir el estándar con el que deben ejecutarse.",
      expected: "Procesos documentados que otro pueda ejecutar con calidad constante.",
      indicator: "Número de procesos documentados y ejecutados por terceros.",
    },
    {
      title: "Fijar límites de carga sostenible",
      objective: "Proteger tu capacidad de entrega y tu margen de decisión.",
      activity: "Definir tus horas máximas semanales de entrega y rediseñar tu agenda para sostenerlas.",
      expected: "Una operación sostenible que no dependa de sobrecarga personal.",
      indicator: "Horas semanales de entrega frente al límite definido.",
    },
  ],
  capitalizacion_conocimiento: [
    {
      title: "Empaquetar tu experiencia en una oferta concreta",
      objective: "Transformar tu conocimiento en algo que el mercado pueda contratar.",
      activity: "Definir en una página: a quién ayudas, con qué problema, qué entregas y qué resultado esperas.",
      expected: "Una propuesta de valor escrita y probada con un contacto real.",
      indicator: "Oferta definida y presentada al menos a tres prospectos.",
    },
    {
      title: "Fijar precios y alcance comercial",
      objective: "Que tu propuesta sea comprable sin negociación improvisada.",
      activity: "Definir tres formatos de trabajo (exploratorio, estándar e intensivo) con alcance y precio claros.",
      expected: "Una escala de oferta lista para citar en cualquier conversación.",
      indicator: "Conversaciones cerradas usando la escala de oferta.",
    },
    {
      title: "Acumular evidencia de resultados",
      objective: "Sostener tu propuesta con pruebas verificables.",
      activity: "Recopilar tres casos o resultados tuyos y redactarlos en formato antes / después / cómo.",
      expected: "Material de evidencia reutilizable en propuestas y conversaciones.",
      indicator: "Casos documentados y utilizados.",
    },
  ],
  adaptacion_profesional: [
    {
      title: "Incorporar IA en tus procesos prioritarios",
      objective: "Ganar tiempo y capacidad con tecnología aplicada de forma medible.",
      activity: "Elegir un proceso repetitivo y construir un flujo con IA que lo reduzca o automatice.",
      expected: "Un proceso mejorado con resultado verificable.",
      indicator: "Tiempo ahorrado por semana en ese proceso.",
    },
    {
      title: "Definir tu ruta de actualización",
      objective: "Prepararte frente a los cambios de tu sector.",
      activity: "Identificar las dos capacidades que tu sector exigirá en 12 meses y programar aprendizaje semanal.",
      expected: "Una ruta de formación con avances visibles.",
      indicator: "Sesiones de aprendizaje completadas por semana.",
    },
    {
      title: "Activar tu red de alternativas",
      objective: "Tener opciones reales si tu contexto cambia.",
      activity: "Contactar cinco personas de tu red y explorar escenarios alternativos de colaboración.",
      expected: "Un mapa de alternativas activas.",
      indicator: "Conversaciones de exploración realizadas.",
    },
  ],
  preparacion_expansion: [
    {
      title: "Ejecutar una primera acción comercial",
      objective: "Pasar de la idea a la primera acción verificable de generación de oportunidades.",
      activity: "Definir una lista de 20 prospectos ideales y contactar los primeros cinco esta semana.",
      expected: "Primeras conversaciones comerciales en marcha.",
      indicator: "Prospectos contactados y conversaciones logradas.",
    },
    {
      title: "Validar tu alternativa de ingresos",
      objective: "Probar tu idea más avanzada con un cliente real.",
      activity: "Ofrecer tu propuesta a dos personas de tu red y recoger objeciones y condiciones.",
      expected: "Señales de validación o una versión mejorada de la oferta.",
      indicator: "Pruebas de oferta realizadas y aprendizajes registrados.",
    },
    {
      title: "Instalar un ritmo de expansión",
      objective: "Volver tu expansión una práctica constante, no un evento.",
      activity: "Bloquear dos horas semanales fijas dedicadas exclusivamente a desarrollar una nueva fuente de ingreso.",
      expected: "Un hábito sostenido de construcción de alternativas.",
      indicator: "Semanas consecutivas cumpliendo el bloque.",
    },
  ],
};

export function computePriorityActions(
  a: AnswerMap,
  top: DimensionKey[],
  alerts: Alert[],
  stage: CodeStage,
): PriorityAction[] {
  const actions: PriorityAction[] = [];
  const seen = new Set<string>();
  const first = top[0] ?? "capitalizacion_conocimiento";
  const second = top[1] ?? "preparacion_expansion";
  const pickFrom = (dim: DimensionKey, variant: number) => {
    const catalog = ACTIONS[dim];
    const action = catalog[variant % catalog.length]!;
    if (!seen.has(action.title)) {
      seen.add(action.title);
      actions.push(action);
    }
  };
  pickFrom(first, 0);
  pickFrom(second, 0);
  // Tercera acción: la alerta más seria o la siguiente dimensión crítica.
  const financialAlert = alerts.find((x) => x.key === "cobertura_financiera");
  if (financialAlert) {
    pickFrom("exposicion_financiera", 1);
  } else if (stage === "Digitalizar" && first !== "adaptacion_profesional") {
    pickFrom("adaptacion_profesional", 0);
  } else {
    pickFrom(second, 1);
  }
  return actions.slice(0, 3);
}

const DIMENSION_VULNERABILITY: Record<DimensionKey, string> = {
  exposicion_financiera:
    "Tu continuidad económica depende casi por completo de una fuente, sin colchón suficiente ni ingresos alternativos consolidados.",
  dependencia_operativa:
    "Tu ingreso depende de tus horas y presencia personal, y tu capacidad de crecer se ha topado con el límite de tu tiempo.",
  capitalizacion_conocimiento:
    "Tu experiencia aún no se ha transformado en una oferta que el mercado pueda contratar de forma independiente.",
  adaptacion_profesional:
    "La tecnología y la IA todavía no forman parte estructural de tu forma de trabajar, y tus alternativas frente a un cambio de sector son limitadas.",
  preparacion_expansion:
    "Las acciones concretas para abrir nuevas fuentes de ingreso todavía no se han convertido en una práctica constante.",
};

export function dimensionVulnerability(key: DimensionKey): string {
  return DIMENSION_VULNERABILITY[key];
}

export function computeDimensionScores(a: AnswerMap): DimensionScore[] {
  return DIMENSIONS.map((d) => {
    const max = d.questions.length * 3;
    const sum = d.questions.reduce((acc, qn) => acc + (a[qn] ?? 0), 0);
    return { key: d.key, label: d.label, score: Math.round((sum / max) * 100), weight: d.weight };
  });
}

export function computeOverallIndex(scores: DimensionScore[]): number {
  return Math.round(scores.reduce((acc, s) => acc + s.score * s.weight, 0));
}

function interpret(interpretation: {
  level: Level;
  index: number;
  top: DimensionKey[];
  strength: DimensionKey;
  alerts: Alert[];
  stage: CodeStage;
  category: SituationCategory;
}): string {
  const opening: Record<Level, string> = {
    Baja:
      "Tu modelo actual muestra niveles de exposición bajos. Tienes margen para decidir con calma, y ese margen es precisamente el mejor momento para construir tu siguiente etapa sin presión.",
    Moderada:
      "Tu modelo actual muestra una exposición moderada. Tu estructura funciona, pero varias de sus piezas dependen de condiciones que podrías empezar a transformar desde ahora.",
    Alta:
      "Tu modelo actual muestra una exposición alta. Tu actividad sostiene tu presente, pero gran parte de tu continuidad depende de factores que hoy no controlas del todo.",
    Crítica:
      "Tu modelo actual muestra una exposición crítica. Tu continuidad económica y profesional depende de muy pocos elementos, y cualquier cambio externo puede impactarte de forma directa.",
  };

  const categoryNote: Record<SituationCategory, string> = {
    empleado: "Como profesional dentro de una organización, tu estabilidad actual es una fortaleza operativa: el objetivo no es criticarla, sino convertirla en plataforma para tus siguientes fuentes de ingreso.",
    independiente: "Como profesional independiente, tu capacidad de generar ingresos está demostrada; el siguiente nivel consiste en que esa capacidad deje de depender exclusivamente de tus horas.",
    empresario: "Como propietario de negocio, tu reto no es la ejecución sino la estructura: ordenar qué se puede delegar, digitalizar y escalar sin depender de tu presencia permanente.",
    transicion: "En plena transición, tu prioridad es convertir la experiencia acumulada en una base nueva y ordenada, en lugar de repetir el modelo que estás dejando atrás.",
  };

  const topLabels = interpretation.top
    .map((k) => DIMENSIONS.find((d) => d.key === k)!.label.toLowerCase())
    .join(" y ");
  const strengthLabel = DIMENSIONS.find((d) => d.key === interpretation.strength)!.label.toLowerCase();

  const alertNote =
    interpretation.alerts.length > 0
      ? ` Además, se activaron ${interpretation.alerts.length === 1 ? "una alerta específica" : `${interpretation.alerts.length} alertas específicas`} que merecen atención aunque el índice general no sea el más alto.`
      : " No se activaron alertas específicas independientes.";

  return [
    opening[interpretation.level],
    categoryNote[interpretation.category],
    `Tus dos áreas de mayor exposición son ${topLabels}. Tu fortaleza relativa está en ${strengthLabel}: es la base sobre la que puedes apoyar tu transformación.`,
    `La etapa de entrada de tu ruta CODE es ${interpretation.stage}, porque es donde tu diagnóstico muestra la mayor palanca de cambio en este momento.`,
    alertNote,
    "Este índice es una herramienta orientativa con umbrales iniciales; no constituye una escala científicamente validada ni una predicción sobre tu situación futura.",
  ].join(" ");
}

export function computeDiagnostic(answers: AnswerMap): DiagnosticResult {
  const dimensionScores = computeDimensionScores(answers);
  const overallIndex = computeOverallIndex(dimensionScores);
  const level = levelOf(overallIndex);
  const alerts = computeAlerts(answers);
  const byScore = [...DIMENSIONS.map((d) => dimensionScores.find((s) => s.key === d.key)!)]
    .sort((x, y) => y.score - x.score);
  const topDimensions = [byScore[0]!.key, byScore[1]!.key];
  const strength = byScore[byScore.length - 1]!.key;
  const codeStage = computeCodeStage(answers, Object.fromEntries(dimensionScores.map((s) => [s.key, s.score])) as Record<DimensionKey, number>);
  const priorityActions = computePriorityActions(answers, topDimensions, alerts, codeStage);

  // La interpretación necesita la categoría de situación; se inyecta aparte.
  return {
    overallIndex,
    level,
    dimensionScores,
    alerts,
    codeStage,
    priorityActions,
    topDimensions,
    strength,
    interpretation: "",
  };
}

/** Versión completa con interpretación personalizada por situación profesional. */
export function computeDiagnosticFull(
  answers: AnswerMap,
  situation: string,
  _goal?: string,
): DiagnosticResult {
  const base = computeDiagnostic(answers);
  const interpretation = interpret({
    level: base.level,
    index: base.overallIndex,
    top: base.topDimensions,
    strength: base.strength,
    alerts: base.alerts,
    stage: base.codeStage,
    category: situationCategory(situation),
  });
  return { ...base, interpretation };
}

export { interpret as buildInterpretation };
