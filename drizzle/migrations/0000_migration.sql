-- ============================================================
-- MAPA DE EXPANSIÓN PROFESIONAL · Tiby Hernández — esquema base
-- ============================================================

create extension if not exists pgcrypto;

-- ============ roles de aplicación ============
create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Los administradores leen roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- ============ sesiones de diagnóstico ============
create table public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  situation text not null,
  experience_range text not null,
  goal_12m text not null,
  status text not null default 'iniciada',
  utm jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

-- ============ respuestas ============
create table public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.assessment_sessions(id) on delete cascade not null,
  question_number int not null check (question_number between 1 and 12),
  answer int not null check (answer between 0 and 3),
  created_at timestamptz not null default now(),
  unique (session_id, question_number)
);

-- ============ resultados ============
create table public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.assessment_sessions(id) on delete cascade not null unique,
  diagnosis_code text not null unique,
  overall_index int not null check (overall_index between 0 and 100),
  level text not null,
  dimension_scores jsonb not null,
  alerts jsonb not null,
  code_stage text not null,
  priority_actions jsonb not null,
  top_dimensions jsonb not null,
  strength jsonb not null,
  interpretation text not null,
  created_at timestamptz not null default now()
);

-- ============ prospectos ============
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.assessment_sessions(id) on delete cascade not null unique,
  name text not null,
  email text not null,
  whatsapp text,
  country text,
  goal text,
  commercial jsonb,
  classification text,
  commercial_status text not null default 'nuevo',
  pdf_downloads int not null default 0,
  created_at timestamptz not null default now()
);

-- ============ consentimientos ============
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.assessment_sessions(id) on delete cascade not null,
  consent_type text not null,
  policy_version text not null default '2026-11-01',
  purpose text not null,
  accepted boolean not null,
  accepted_at timestamptz not null default now()
);

-- ============ eventos comerciales ============
create table public.commercial_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.assessment_sessions(id) on delete cascade,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============ notas privadas ============
create table public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade not null,
  author_id uuid,
  body text not null,
  created_at timestamptz not null default now()
);

-- ============ ajustes configurables ============
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ============ GRANTs ============
GRANT ALL ON public.assessment_sessions, public.assessment_answers,
  public.assessment_results, public.leads, public.consents,
  public.commercial_events, public.admin_notes, public.app_settings TO service_role;
GRANT SELECT ON public.app_settings TO anon, authenticated;

ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- El acceso público se realiza únicamente mediante funciones SECURITY DEFINER,
-- por lo que las tablas permanecen cerradas para anon y authenticated.

-- ============ funciones seguras para el flujo público ============

create or replace function public.start_assessment_session(
  p_situation text, p_experience_range text, p_goal_12m text, p_utm jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_token text; v_id uuid;
begin
  v_token := replace(replace(rtrim(encode(gen_random_bytes(32), 'base64'), '='), '/', '_'), '+', '-');
  insert into assessment_sessions (token, situation, experience_range, goal_12m, utm)
    values (v_token, left(p_situation, 80), left(p_experience_range, 40), left(p_goal_12m, 80), p_utm)
    returning id into v_id;
  insert into commercial_events (session_id, event_type, metadata)
    values (v_id, 'sesion_iniciada', jsonb_build_object('situation', p_situation));
  return jsonb_build_object('session_id', v_id, 'token', v_token, 'expires_at', (select expires_at from assessment_sessions where id = v_id));
end $$;

create or replace function public.get_assessment_state(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'situation', s.situation, 'experience_range', s.experience_range, 'goal_12m', s.goal_12m,
    'status', s.status, 'expires_at', s.expires_at,
    'answers', coalesce((select jsonb_object_agg(a.question_number, a.answer) from assessment_answers a where a.session_id = s.id), '{}'::jsonb)
  ) into v
  from assessment_sessions s
  where s.token = p_token and s.expires_at > now();
  return v;
end $$;

create or replace function public.save_assessment_answer(p_token text, p_question int, p_answer int)
returns void
language plpgsql security definer set search_path = public as $$
declare v_sid uuid;
begin
  select id into v_sid from assessment_sessions
    where token = p_token and expires_at > now() and status <> 'completada';
  if v_sid is null then raise exception 'sesion_no_valida'; end if;
  if p_question between 1 and 12 and p_answer between 0 and 3 then
    insert into assessment_answers (session_id, question_number, answer)
      values (v_sid, p_question, p_answer)
      on conflict (session_id, question_number) do update
        set answer = excluded.answer, created_at = now();
  else
    raise exception 'respuesta_invalida';
  end if;
end $$;

create or replace function public.save_assessment_result(p_token text, p_result jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_sid uuid; v_code text;
begin
  select id into v_sid from assessment_sessions where token = p_token and expires_at > now();
  if v_sid is null then raise exception 'sesion_no_valida'; end if;
  if exists (select 1 from assessment_results where session_id = v_sid) then
    select diagnosis_code into v_code from assessment_results where session_id = v_sid;
    update assessment_sessions set status = 'completada', completed_at = coalesce(completed_at, now()) where id = v_sid;
    return jsonb_build_object('diagnosis_code', v_code);
  end if;
  v_code := 'MEP-' || upper(encode(gen_random_bytes(4), 'hex'));
  insert into assessment_results (session_id, diagnosis_code, overall_index, level, dimension_scores,
    alerts, code_stage, priority_actions, top_dimensions, strength, interpretation)
  values (
    v_sid, v_code,
    (p_result->>'overall_index')::int,
    left(p_result->>'level', 40),
    coalesce(p_result->'dimension_scores', '{}'::jsonb),
    coalesce(p_result->'alerts', '[]'::jsonb),
    left(p_result->>'code_stage', 40),
    coalesce(p_result->'priority_actions', '[]'::jsonb),
    coalesce(p_result->'top_dimensions', '[]'::jsonb),
    coalesce(p_result->'strength', 'null'::jsonb),
    left(p_result->>'interpretation', 4000)
  );
  update assessment_sessions set status = 'completada', completed_at = now() where id = v_sid;
  insert into commercial_events (session_id, event_type) values (v_sid, 'diagnostico_completado');
  return jsonb_build_object('diagnosis_code', v_code);
end $$;

create or replace function public.get_assessment_result(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select to_jsonb(r) || jsonb_build_object(
    'situation', s.situation, 'experience_range', s.experience_range, 'goal_12m', s.goal_12m,
    'completed_at', s.completed_at, 'expires_at', s.expires_at
  ) into v
  from assessment_sessions s join assessment_results r on r.session_id = s.id
  where s.token = p_token and s.expires_at > now();
  if v is null then raise exception 'resultado_no_disponible'; end if;
  return v;
end $$;

create or replace function public.save_lead(
  p_token text, p_name text, p_email text, p_whatsapp text,
  p_country text, p_goal text, p_marketing_consent boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_sid uuid; v_lead uuid;
begin
  select id into v_sid from assessment_sessions where token = p_token and expires_at > now();
  if v_sid is null then raise exception 'sesion_no_valida'; end if;
  if p_name is null or length(trim(p_name)) < 2 then raise exception 'nombre_invalido'; end if;
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'correo_invalido'; end if;
  insert into leads (session_id, name, email, whatsapp, country, goal)
    values (v_sid, left(trim(p_name), 120), left(lower(trim(p_email)), 160),
            left(coalesce(p_whatsapp, ''), 40), left(coalesce(p_country, ''), 60), left(coalesce(p_goal, ''), 80))
    on conflict (session_id) do update set
      name = excluded.name, email = excluded.email, whatsapp = excluded.whatsapp,
      country = excluded.country, goal = excluded.goal
    returning id into v_lead;
  insert into consents (session_id, consent_type, purpose, accepted)
    values (v_sid, 'tratamiento_datos', 'Gestión del diagnóstico y entrega del informe', true);
  insert into consents (session_id, consent_type, purpose, accepted)
    values (v_sid, 'uso_comercial', 'Comunicaciones comerciales de Tiby Hernández', p_marketing_consent);
  insert into commercial_events (session_id, event_type) values (v_sid, 'prospecto_capturado');
  return v_lead;
end $$;

create or replace function public.save_commercial_answers(p_token text, p_commercial jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare v_sid uuid; v_class text;
begin
  select id into v_sid from assessment_sessions where token = p_token and expires_at > now();
  if v_sid is null then raise exception 'sesion_no_valida'; end if;
  if p_commercial->>'wants' <> 'si' then
    update leads set classification = 'nutrir_contenidos', commercial = p_commercial where session_id = v_sid;
    insert into commercial_events (session_id, event_type, metadata)
      values (v_sid, 'clasificacion_comercial', jsonb_build_object('wants', 'no'));
    return 'nutrir_contenidos';
  end if;
  v_class := case
    when (p_commercial->>'timing') in ('inmediatamente','30_dias')
     and (p_commercial->>'modality') = 'individual'
     and (p_commercial->>'investment') in ('premium','programa') then 'prospecto_1a1'
    when (p_commercial->>'modality') = 'grupal' or (p_commercial->>'timing') in ('30_dias','90_dias') then 'mentorias_grupal'
    when (p_commercial->>'investment') = 'sin_inversion' then 'sin_intencion_comercial'
    else 'nutrir_contenidos' end;
  update leads set commercial = p_commercial, classification = v_class where session_id = v_sid;
  insert into commercial_events (session_id, event_type, metadata)
    values (v_sid, 'clasificacion_comercial', p_commercial || jsonb_build_object('classification', v_class));
  return v_class;
end $$;

create or replace function public.log_commercial_event(p_token text, p_type text, p_meta jsonb default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_sid uuid;
begin
  select id into v_sid from assessment_sessions where token = p_token and expires_at > now();
  if v_sid is null then return; end if;
  insert into commercial_events (session_id, event_type, metadata)
    values (v_sid, left(p_type, 60), p_meta);
end $$;

create or replace function public.increment_pdf_downloads(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update leads set pdf_downloads = pdf_downloads + 1
  where session_id = (select id from assessment_sessions where token = p_token and expires_at > now());
end $$;

GRANT EXECUTE ON FUNCTION public.start_assessment_session(text, text, text, jsonb),
  public.get_assessment_state(text), public.save_assessment_answer(text, int, int),
  public.save_assessment_result(text, jsonb), public.get_assessment_result(text),
  public.save_lead(text, text, text, text, text, text, boolean),
  public.save_commercial_answers(text, jsonb), public.log_commercial_event(text, text, jsonb),
  public.increment_pdf_downloads(text)
TO anon, authenticated;
