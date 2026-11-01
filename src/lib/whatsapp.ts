/** Enlaces y mensajes de WhatsApp de la aplicación. */
export const WHATSAPP_PHONE = "573134654162"; // elegido por la usuaria (2026-11-01)
export const WHATSAPP_SHORT_URL = "https://wa.link/k12c08";

export function whatsappHref(message?: string): string {
  if (!message) return WHATSAPP_SHORT_URL;
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

export function buildDiagnosisMessage(input: {
  levelLabel: string;
  topDimensionLabel: string;
  codeStage: string;
  diagnosisCode: string;
}): string {
  return [
    `Hola, Tiby. Acabo de realizar el diagnóstico Mapa de Expansión Profesional.`,
    `Mi nivel de criticidad es ${input.levelLabel.toUpperCase()} y mi principal prioridad es trabajar sobre ${input.topDimensionLabel.toLowerCase()} de mi modelo actual.`,
    `Mi ruta sugerida comienza por la etapa ${input.codeStage}.`,
    `Me gustaría conversar sobre las opciones de acompañamiento para desarrollar mi siguiente etapa profesional.`,
    `Mi código de diagnóstico es ${input.diagnosisCode}.`,
  ].join(" ");
}
