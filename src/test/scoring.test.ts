import { describe, it, expect } from "vitest";
import {
  computeDiagnosticFull,
  computeAlerts,
  computeCodeStage,
  levelOf,
  computeDimensionScores,
  computeOverallIndex,
  DIMENSIONS,
  type AnswerMap,
} from "@/lib/diagnostic/scoring";

const fullLow = (): AnswerMap =>
  Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => [n, 0])) as AnswerMap;
const fullHigh = (): AnswerMap =>
  Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => [n, 3])) as AnswerMap;

describe("motor de criticidad", () => {
  it("los resultados extremos producen 0 y 100", () => {
    const low = computeDiagnosticFull(fullLow(), "Empleado o ejecutivo");
    const high = computeDiagnosticFull(fullHigh(), "Empleado o ejecutivo");
    expect(low.overallIndex).toBe(0);
    expect(high.overallIndex).toBe(100);
    expect(low.level).toBe("Baja");
    expect(high.level).toBe("Crítica");
  });

  it("los pesos de las cinco dimensiones suman 1", () => {
    const total = DIMENSIONS.reduce((a, d) => a + d.weight, 0);
    expect(total).toBeCloseTo(1);
  });

  it("cada dimensión se normaliza de 0 a 100", () => {
    const answers = { 1: 3, 2: 0 } as AnswerMap;
    const scores = computeDimensionScores(answers);
    const financiera = scores.find((s) => s.key === "exposicion_financiera")!;
    expect(financiera.score).toBe(50); // 3/6
    expect(computeOverallIndex(scores)).toBe(Math.round(50 * 0.25));
  });

  it("los niveles se asignan por umbrales", () => {
    expect(levelOf(0)).toBe("Baja");
    expect(levelOf(25)).toBe("Baja");
    expect(levelOf(26)).toBe("Moderada");
    expect(levelOf(50)).toBe("Moderada");
    expect(levelOf(51)).toBe("Alta");
    expect(levelOf(75)).toBe("Alta");
    expect(levelOf(76)).toBe("Crítica");
  });

  it("la alerta de baja cobertura financiera se activa solo con pregunta 1 = 3", () => {
    expect(computeAlerts({ 1: 3 } as AnswerMap).map((a) => a.key)).toContain("cobertura_financiera");
    expect(computeAlerts({ 1: 2 } as AnswerMap).map((a) => a.key)).not.toContain("cobertura_financiera");
  });

  it("la alerta de concentración de ingresos se activa solo con pregunta 2 = 3", () => {
    expect(computeAlerts({ 2: 3 } as AnswerMap).map((a) => a.key)).toContain("concentracion_ingresos");
    expect(computeAlerts({ 2: 2 } as AnswerMap).map((a) => a.key)).not.toContain("concentracion_ingresos");
  });

  it("la alerta de dependencia operativa se activa solo con pregunta 3 = 3", () => {
    expect(computeAlerts({ 3: 3 } as AnswerMap).map((a) => a.key)).toContain("dependencia_operativa");
  });

  it("la alerta del modelo basado en horas exige preguntas 4 y 5 en 3", () => {
    expect(computeAlerts({ 4: 3, 5: 3 } as AnswerMap).map((a) => a.key)).toContain("modelo_horas");
    expect(computeAlerts({ 4: 3, 5: 2 } as AnswerMap).map((a) => a.key)).not.toContain("modelo_horas");
  });

  it("la alerta de preparación comercial exige 6, 7 y 12 elevadas", () => {
    expect(computeAlerts({ 6: 2, 7: 2, 12: 2 } as AnswerMap).map((a) => a.key)).toContain("preparacion_comercial");
    expect(computeAlerts({ 6: 1, 7: 2, 12: 2 } as AnswerMap).map((a) => a.key)).not.toContain(
      "preparacion_comercial",
    );
  });

  it("alta capitalización prioriza Convertir", () => {
    const answers = { 7: 3, 8: 3, 1: 0, 2: 0 } as AnswerMap;
    const scores = Object.fromEntries(
      computeDimensionScores(answers).map((s) => [s.key, s.score]),
    ) as Record<string, number>;
    expect(computeCodeStage(answers, scores as never)).toBe("Convertir");
  });

  it("oferta definida pero comercial pendiente prioriza Ordenar", () => {
    const answers = { 7: 1, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 } as AnswerMap;
    const scores = Object.fromEntries(
      computeDimensionScores(answers).map((s) => [s.key, s.score]),
    ) as Record<string, number>;
    expect(computeCodeStage(answers, scores as never)).toBe("Ordenar");
  });

  it("la interpretación no es idéntica entre diagnósticos distintos", () => {
    const a = computeDiagnosticFull(fullLow(), "Empleado o ejecutivo");
    const b = computeDiagnosticFull(fullHigh(), "Consultor independiente");
    expect(a.interpretation).not.toBe(b.interpretation);
    expect(a.interpretation.length).toBeGreaterThan(50);
  });

  it("siempre entrega tres acciones prioritarias", () => {
    const result = computeDiagnosticFull(fullLow(), "Empresario o propietario de negocio");
    expect(result.priorityActions).toHaveLength(3);
    for (const action of result.priorityActions) {
      expect(action.objective).toBeTruthy();
      expect(action.activity).toBeTruthy();
      expect(action.expected).toBeTruthy();
      expect(action.indicator).toBeTruthy();
    }
  });

  it("las respuestas comerciales nunca modifican el índice (motor no las recibe)", () => {
    const result = computeDiagnosticFull(fullLow(), "Empleado o ejecutivo");
    expect(Object.keys(result)).not.toContain("commercial");
  });
});
