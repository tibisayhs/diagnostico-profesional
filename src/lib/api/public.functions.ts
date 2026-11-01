/**
 * Funciones de servidor del flujo público del diagnóstico.
 * Todo el acceso a datos pasa por funciones SECURITY DEFINER en la base,
 * que validan el token de sesión; las tablas permanecen cerradas para el público.
 */
import { createServerFn } from "@tanstack/react-start";
import { publishableClient } from "./supabase-public.server";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = publishableClient();
  // Llamar como método (supabase.rpc) para conservar `this`; extraerlo rompe el cliente.
  const { data, error } = (await (supabase as any).rpc(fn, args)) as {
    data: T | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(error.message);
  return data as T;
}

export const startAssessment = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      situation: string;
      experienceRange: string;
      goal12m: string;
      utm?: Record<string, string>;
    }) => input,
  )
  .handler(({ data }) =>
    rpc<{ session_id: string; token: string; expires_at: string }>("start_assessment_session", {
      p_situation: data.situation,
      p_experience_range: data.experienceRange,
      p_goal_12m: data.goal12m,
      p_utm: data.utm ?? null,
    }),
  );

export const getAssessmentState = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => input)
  .handler(({ data }) =>
    rpc<{
      situation: string;
      experience_range: string;
      goal_12m: string;
      status: string;
      expires_at: string;
      answers: Record<string, number>;
    } | null>("get_assessment_state", { p_token: data.token }),
  );

export const saveAssessmentAnswer = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; question: number; answer: number }) => input)
  .handler(({ data }) =>
    rpc<null>("save_assessment_answer", {
      p_token: data.token,
      p_question: data.question,
      p_answer: data.answer,
    }),
  );

export const saveAssessmentResult = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; result: unknown }) => input)
  .handler(({ data }) =>
    rpc<{ diagnosis_code: string }>("save_assessment_result", {
      p_token: data.token,
      p_result: data.result,
    }),
  );

export const getAssessmentResult = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => input)
  .handler(({ data }) =>
    rpc<Record<string, any>>("get_assessment_result", { p_token: data.token }),
  );

export const saveLead = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token: string;
      name: string;
      email: string;
      whatsapp?: string;
      country?: string;
      goal?: string;
      marketingConsent: boolean;
    }) => input,
  )
  .handler(({ data }) =>
    rpc<string>("save_lead", {
      p_token: data.token,
      p_name: data.name,
      p_email: data.email,
      p_whatsapp: data.whatsapp ?? "",
      p_country: data.country ?? "",
      p_goal: data.goal ?? "",
      p_marketing_consent: data.marketingConsent,
    }),
  );

export const saveCommercialAnswers = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { token: string; commercial: { wants: string; timing?: string; modality?: string; investment?: string } }) =>
      input,
  )
  .handler(({ data }) =>
    rpc<string>("save_commercial_answers", { p_token: data.token, p_commercial: data.commercial }),
  );

export const logEvent = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; type: string; meta?: Record<string, unknown> }) => input)
  .handler(({ data }) =>
    rpc<null>("log_commercial_event", { p_token: data.token, p_type: data.type, p_meta: data.meta ?? null }),
  );
