/**
 * Las 12 preguntas del diagnóstico de criticidad.
 * Puntuación de criticidad por respuesta: 0 (menor exposición) … 3 (exposición elevada).
 * Fuente: PROMPT MAESTRO PARA LOVABLE, sección 4.
 */

export type SituationOption =
  | "Empleado o ejecutivo"
  | "Consultor independiente"
  | "Especialista que trabaja por cuenta propia"
  | "Mentor, formador o asesor"
  | "Empresario o propietario de negocio"
  | "Profesional en transición";

export const SITUATIONS: SituationOption[] = [
  "Empleado o ejecutivo",
  "Consultor independiente",
  "Especialista que trabaja por cuenta propia",
  "Mentor, formador o asesor",
  "Empresario o propietario de negocio",
  "Profesional en transición",
];

export const EXPERIENCE_RANGES = [
  "Menos de 5 años",
  "Entre 5 y 10 años",
  "Entre 11 y 20 años",
  "Más de 20 años",
];

export const GOALS_12M = [
  "Diversificar ingresos",
  "Crear un negocio basado en mi experiencia",
  "Escalar mi actividad actual",
  "Preparar una transición profesional",
  "Incorporar IA para mejorar mi productividad",
  "Explorar oportunidades",
];

/** Categoría para adaptar los textos introductorios de cada bloque. */
export type SituationCategory = "empleado" | "independiente" | "empresario" | "transicion";

export function situationCategory(situation: string): SituationCategory {
  if (situation.startsWith("Empleado")) return "empleado";
  if (situation.startsWith("Empresario")) return "empresario";
  if (situation.startsWith("Profesional")) return "transicion";
  return "independiente";
}

export type BlockKey = "financiera" | "operativa" | "conocimiento" | "adaptacion" | "expansion";

export const BLOCK_LABELS: Record<BlockKey, string> = {
  financiera: "Exposición financiera",
  operativa: "Dependencia operativa",
  conocimiento: "Capitalización del conocimiento",
  adaptacion: "Adaptación profesional y tecnológica",
  expansion: "Preparación para la expansión",
};

const BLOCK_INTROS: Record<BlockKey, Record<SituationCategory, string>> = {
  financiera: {
    empleado:
      "Este bloque revisa el sustento económico de tu empleo actual: cuánto colchón tienes y qué tan repartido está tu ingreso.",
    independiente:
      "Este bloque revisa el sustento económico de tu actividad: cuánto colchón tienes y qué tan repartido está tu ingreso.",
    empresario:
      "Este bloque revisa el sustento económico de tu empresa: cuánto colchón tienes y qué tan concentrado está tu ingreso.",
    transicion:
      "Este bloque revisa el sustento económico de tu etapa actual: cuánto colchón tienes y qué tan repartido está tu ingreso.",
  },
  operativa: {
    empleado:
      "Aquí exploramos cuánto depende tu ingreso de tu tiempo y presencia en la organización que te emplea.",
    independiente:
      "Aquí exploramos cuánto depende tu ingreso de tus horas personales de trabajo y de tu capacidad actual.",
    empresario:
      "Aquí exploramos cuánto depende el ingreso de tu negocio de tu presencia personal y de sus límites de crecimiento.",
    transicion:
      "Aquí exploramos cuánto depende tu ingreso de tus horas personales y de la actividad que hoy te sostiene.",
  },
  conocimiento: {
    empleado:
      "Este bloque mide hasta qué punto tu experiencia se ha convertido en algo que el mercado puede contratar de forma independiente.",
    independiente:
      "Este bloque mide hasta qué punto tu experiencia se ha convertido en una oferta que otros ya contratan.",
    empresario:
      "Este bloque mide hasta qué punto tu experiencia está organizada como una propuesta comercializable, dentro o fuera de tu empresa.",
    transicion:
      "Este bloque mide hasta qué punto tu experiencia se ha estructurado como algo que el mercado puede contratar.",
  },
  adaptacion: {
    empleado:
      "Aquí observamos tu preparación frente al cambio tecnológico y a los movimientos de tu sector.",
    independiente:
      "Aquí observamos tu adopción de tecnología e IA y tu preparación frente a los movimientos de tu sector.",
    empresario:
      "Aquí observamos la adopción de tecnología e IA en tu empresa y su preparación frente a los cambios del sector.",
    transicion:
      "Aquí observamos tu preparación frente al cambio tecnológico y a los movimientos de tu sector.",
  },
  expansion: {
    empleado:
      "Este bloque evalúa las acciones concretas que has dado para generar oportunidades y nuevas fuentes de ingreso.",
    independiente:
      "Este bloque evalúa las acciones concretas que has dado para generar oportunidades y nuevas fuentes de ingreso.",
    empresario:
      "Este bloque evalúa las acciones concretas que has dado para abrir tu negocio a nuevas fuentes de ingreso.",
    transicion:
      "Este bloque evalúa las acciones concretas que has dado para construir tu siguiente etapa profesional.",
  },
};

export interface QuestionOption {
  label: string;
  score: 0 | 1 | 2 | 3;
}

export interface Question {
  number: number;
  block: BlockKey;
  text: string;
  options: QuestionOption[];
}

export const QUESTIONS: Question[] = [
  {
    number: 1,
    block: "financiera",
    text: "Si dejaras de recibir ingresos de tu principal empleo, empresa o cliente, ¿por cuánto tiempo podrías cubrir tus gastos esenciales?",
    options: [
      { label: "Más de 12 meses", score: 0 },
      { label: "Entre 6 y 12 meses", score: 1 },
      { label: "Entre 1 y 5 meses", score: 2 },
      { label: "Menos de un mes", score: 3 },
    ],
  },
  {
    number: 2,
    block: "financiera",
    text: "¿Qué porcentaje de tus ingresos proviene de una sola empresa, empleo o cliente?",
    options: [
      { label: "Menos del 25%", score: 0 },
      { label: "Entre 25% y 49%", score: 1 },
      { label: "Entre 50% y 79%", score: 2 },
      { label: "80% o más", score: 3 },
    ],
  },
  {
    number: 3,
    block: "operativa",
    text: "Si dejaras de trabajar personalmente durante 30 días, ¿qué ocurriría con tus ingresos?",
    options: [
      { label: "Se mantendrían casi todos", score: 0 },
      { label: "Perdería menos de la mitad", score: 1 },
      { label: "Perdería más de la mitad", score: 2 },
      { label: "Prácticamente desaparecerían", score: 3 },
    ],
  },
  {
    number: 4,
    block: "operativa",
    text: "¿Cuánto dependen tus ingresos de las horas que dedicas personalmente al trabajo?",
    options: [
      { label: "Puedo generar ingresos sin aumentar mis horas", score: 0 },
      { label: "Existe una dependencia parcial", score: 1 },
      { label: "La mayor parte depende de mis horas", score: 2 },
      { label: "Todos mis ingresos dependen de trabajar personalmente", score: 3 },
    ],
  },
  {
    number: 5,
    block: "operativa",
    text: "Si quisieras aumentar tus ingresos un 50%, ¿qué necesitarías hacer con tu modelo actual?",
    options: [
      { label: "Aprovechar un sistema comercial u operativo existente", score: 0 },
      { label: "Realizar algunos ajustes y ampliar mi capacidad", score: 1 },
      { label: "Conseguir más clientes y trabajar considerablemente más horas", score: 2 },
      { label: "Hoy no tengo capacidad para hacerlo sin aumentar sustancialmente mi carga", score: 3 },
    ],
  },
  {
    number: 6,
    block: "expansion",
    text: "¿Qué tan preparado estás para generar ingresos fuera de tu actividad principal?",
    options: [
      { label: "Ya cuento con fuentes alternativas de ingresos", score: 0 },
      { label: "Tengo una alternativa validada que estoy desarrollando", score: 1 },
      { label: "Tengo ideas, pero todavía no las he validado", score: 2 },
      { label: "Dependo totalmente de mi actividad actual y no tengo alternativas definidas", score: 3 },
    ],
  },
  {
    number: 7,
    block: "conocimiento",
    text: "¿Qué has hecho para convertir tu experiencia profesional en una solución que otros puedan contratar?",
    options: [
      { label: "Tengo ofertas comercializadas y validadas", score: 0 },
      { label: "Tengo una propuesta definida y he comenzado a validarla", score: 1 },
      { label: "He pensado en ofrecer mi experiencia, pero no he estructurado una oferta", score: 2 },
      { label: "No he identificado cómo comercializar mi conocimiento", score: 3 },
    ],
  },
  {
    number: 8,
    block: "conocimiento",
    text: "Si una empresa o cliente potencial quisiera contratarte como especialista independiente, ¿qué tendrías preparado?",
    options: [
      { label: "Propuesta, alcance, precios y evidencia de resultados", score: 0 },
      { label: "Oferta definida, con elementos comerciales pendientes", score: 1 },
      { label: "Una explicación general de lo que podría hacer", score: 2 },
      { label: "Tendría que construir toda la propuesta desde cero", score: 3 },
    ],
  },
  {
    number: 9,
    block: "expansion",
    text: "Durante los últimos 90 días, ¿qué oportunidades comerciales has generado por iniciativa propia?",
    options: [
      { label: "He generado oportunidades y cerrado ventas", score: 0 },
      { label: "He sostenido conversaciones comerciales calificadas", score: 1 },
      { label: "He realizado algunos contactos sin seguimiento estructurado", score: 2 },
      { label: "No he realizado acciones para generar oportunidades", score: 3 },
    ],
  },
  {
    number: 10,
    block: "adaptacion",
    text: "¿Cómo utilizas actualmente la inteligencia artificial y otras herramientas digitales en tu trabajo?",
    options: [
      { label: "Tengo procesos definidos que generan mejoras verificables", score: 0 },
      { label: "Utilizo herramientas con regularidad en varias actividades", score: 1 },
      { label: "Las utilizo ocasionalmente", score: 2 },
      { label: "No las he incorporado a mi actividad profesional", score: 3 },
    ],
  },
  {
    number: 11,
    block: "adaptacion",
    text: "Si tu sector profesional cambiara significativamente durante el próximo año, ¿qué alternativas tendrías?",
    options: [
      { label: "Tengo capacidades, contactos y opciones que podría activar", score: 0 },
      { label: "He identificado alternativas y estoy preparándome", score: 1 },
      { label: "Reconozco la necesidad de adaptarme, pero no tengo una ruta", score: 2 },
      { label: "No tengo alternativas identificadas", score: 3 },
    ],
  },
  {
    number: 12,
    block: "expansion",
    text: "¿Qué acciones concretas has realizado durante los últimos 90 días para desarrollar una nueva oportunidad de ingresos?",
    options: [
      { label: "He implementado acciones y obtenido resultados medibles", score: 0 },
      { label: "He iniciado acciones con objetivos definidos", score: 1 },
      { label: "He investigado oportunidades sin ejecutarlas", score: 2 },
      { label: "No he realizado acciones", score: 3 },
    ],
  },
];

export function blockIntro(block: BlockKey, situation: string): string {
  const category = situationCategory(situation);
  return BLOCK_INTROS[block][category];
}

export function questionBlockIntro(questionNumber: number, situation: string): string {
  const q = QUESTIONS.find((x) => x.number === questionNumber)!;
  const firstOfBlock = QUESTIONS.find((x) => x.block === q.block)!.number;
  if (questionNumber === firstOfBlock) return blockIntro(q.block, situation);
  return "";
}
