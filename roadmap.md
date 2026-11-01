# Roadmap — MAPA DE EXPANSIÓN PROFESIONAL (Tiby Hernández)

Fuente: PROMPT MAESTRO PARA LOVABLE (documento completo pegado en el chat, 2026-11-01).

## Hecho
- [x] Lovable Cloud activado (base de datos + auth email).
- [x] Migración: assessment_sessions, assessment_answers, assessment_results, leads, consents, commercial_events, admin_notes, app_settings, user_roles + RLS + grants + has_role + funciones SECURITY DEFINER con token y caducidad de 7 días.
- [x] Ajustes iniciales sembrados (precios 1:1 7500 USD, grupal 1200 USD; versión de política).
- [x] Cuenta admin creada: ceo.tibyhernandez@gmail.com (rol admin en user_roles).
- [x] Motor de diagnóstico determinista (12 preguntas, dimensiones, pesos, índice, niveles, alertas, ruta CODE, acciones, interpretación) + 14 pruebas vitest (pasan).
- [x] Portada ampliada (lo que descubrirás, CODE, privacidad).
- [x] Perfil profesional + diagnóstico (12 preguntas, una por pantalla, progreso, autosave, teclado, móvil, recuperación 7 días).
- [x] Resultado personalizado (índice, nivel, interpretación, top 2, fortaleza, alertas, 3 acciones, vulnerabilidad principal).
- [x] Mapa de criticidad: radar (escritorio) + barras (móvil).
- [x] Mapa CODE con etapa de entrada destacada.
- [x] Captura de prospectos + consentimientos separados (datos necesario, comercial opcional desmarcado).
- [x] Calificación comercial opcional + clasificación interna (no modifica el índice).
- [x] PDF ejecutivo de 9 páginas en el servidor (pdf-lib: portada negra, radar dibujado, QR de WhatsApp, enlace, pie con marca y código).
- [x] Descarga autorizada por token: /api/public/pdf/$token + registro de descargas y evento.
- [x] WhatsApp +57 313 465 4162 con mensaje dinámico (nivel, dimensión, etapa CODE, código) y botón wa.link/k12c08.
- [x] Panel administrativo protegido (_authenticated + /auth): métricas, filtros, ficha del prospecto, estados comerciales, notas, CSV, precios editables.
- [x] Correcciones de tipos aplicadas tras la revisión de compilación (pendiente de re-verificación).

## Pendiente
- [x] Distintivo de Lovable confirmado oculto; pantallas públicas verificadas a 320, 489, 768 y 1280 px sin desbordamiento; inicio del cuestionario y controles de resultados comprobados.
- [x] Re-verificar compilación: build OK y 15 pruebas aprobadas (2026-11-01).
- [ ] Prueba Playwright end-to-end: flujo completo portada → diagnóstico → resultado → captura → descarga de PDF → WhatsApp.
- [ ] Validar el PDF generado (páginas, radar, QR, texto seleccionable) y el enlace de WhatsApp dentro del PDF.
- [ ] Verificar presentación del panel con sesión admin: sesión creada, pero la restauración en navegador no permite entrar; cambios de presentación aplicados, comprobación visual pendiente.
- [ ] Publicar cuando la usuaria lo pida.
