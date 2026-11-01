/**
 * Generador del informe ejecutivo PDF (A4, 6 páginas) con pdf-lib.
 * Se ejecuta en el servidor; los datos provienen de la base mediante el token de sesión.
 */
import { PDFDocument, PDFString, PDFFont as PDFFontClass, PDFPage as PDFPageClass, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { DiagnosticResult, PriorityAction } from "@/lib/diagnostic/scoring";
import { CODE_STAGES, dimensionVulnerability, type AnswerMap } from "@/lib/diagnostic/scoring";
import { whatsappHref } from "@/lib/whatsapp";
import { LOGO_CREAM_B64 } from "./logo-data";

/**
 * Las fuentes estándar del PDF solo admiten WinAnsi: cualquier carácter fuera de ese juego
 * (flechas, emojis, comillas raras) haría fallar todo el informe. Se sustituyen de forma global.
 */
const REPLACEMENTS: Record<string, string> = { "→": ">", "←": "<", "✓": "-", "≥": ">=", "≤": "<=", "\u00a0": " " };
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
export function toWinAnsi(text: string): string {
  let out = "";
  for (const ch of String(text ?? "")) {
    if (REPLACEMENTS[ch] !== undefined) out += REPLACEMENTS[ch];
    else {
      const c = ch.codePointAt(0)!;
      if (c === 10 || c === 13 || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.has(ch)) out += ch;
      else out += ch.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
    }
  }
  return out;
}
const g = globalThis as { __pdfWinAnsiPatched?: boolean };
if (!g.__pdfWinAnsiPatched) {
  g.__pdfWinAnsiPatched = true;
  const drawText = PDFPageClass.prototype.drawText;
  PDFPageClass.prototype.drawText = function (text: string, options?: Parameters<typeof drawText>[1]) {
    return drawText.call(this, toWinAnsi(text), options);
  };
  const width = PDFFontClass.prototype.widthOfTextAtSize;
  PDFFontClass.prototype.widthOfTextAtSize = function (text: string, size: number) {
    return width.call(this, toWinAnsi(text), size);
  };
}


const A4: [number, number] = [595.28, 841.89];
const BLACK = rgb(0.008, 0.008, 0.008); // #020202
const CREAM = rgb(0.984, 0.973, 0.957); // #FBF8F4
const LIME = rgb(0.757, 1, 0.447); // #C1FF72
const ORANGE = rgb(1, 0.459, 0.122); // #FF751F
const GREY = rgb(0.55, 0.53, 0.5);
const INK_SOFT = rgb(0.32, 0.31, 0.29);

interface Fonts {
  title: PDFFont;
  body: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

export interface ReportPayload {
  overall_index: number;
  level: string;
  dimension_scores: { key: string; label: string; score: number }[];
  alerts: { key: string; title: string; description: string }[];
  code_stage: string;
  priority_actions: PriorityAction[];
  top_dimensions: string[];
  strength: string;
  interpretation: string;
  diagnosis_code: string;
  situation: string;
  experience_range: string;
  goal_12m: string;
  completed_at: string;
  lead_name: string | null;
  answers?: Record<string, number>;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface DrawOpts {
  font: PDFFont;
  size: number;
  lineHeight?: number;
  color?: ReturnType<typeof rgb>;
  x: number;
  y: number;
  maxWidth: number;
}

function drawParagraph(page: PDFPage, text: string, opts: DrawOpts): number {
  const { font, size, x, maxWidth } = opts;
  let yy = opts.y;
  const lineHeight = opts.lineHeight ?? size * 1.45;
  const lines = wrapText(text, font, size, maxWidth);
  for (const line of lines) {
    page.drawText(line, { x, y: yy, size, font, color: opts.color ?? INK_SOFT });
    yy -= lineHeight;
  }
  return yy;
}

function header(page: PDFPage, doc: PDFDocument, fonts: Fonts, label: string, code: string) {
  page.drawRectangle({ x: 0, y: A4[1] - 64, width: A4[0], height: 64, color: BLACK });
  page.drawText(label.toUpperCase(), { x: 48, y: A4[1] - 40, size: 9, font: fonts.bold, color: LIME });
  page.drawText(code, { x: A4[0] - 48 - fonts.body.widthOfTextAtSize(code, 8), y: A4[1] - 40, size: 8, font: fonts.body, color: CREAM });
  // Pie de página
  page.drawRectangle({ x: 0, y: 0, width: A4[0], height: 36, color: BLACK });
  const brand = "Tiby Hernández · Mapa de Expansión Profesional";
  page.drawText(brand, { x: 48, y: 14, size: 8, font: fonts.body, color: CREAM });
}

function drawRadar(
  page: PDFPage,
  cx: number,
  cy: number,
  radius: number,
  scores: { label: string; score: number }[],
  fonts: Fonts,
) {
  const n = scores.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, r: number) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;

  // Anillos
  for (const ring of [0.25, 0.5, 0.75, 1]) {
    const pts: number[][] = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = point(i, radius * ring);
      pts.push([x, y]);
    }
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pts[i]!;
      const [x2, y2] = pts[(i + 1) % n]!;
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: ring === 1 ? 1.1 : 0.6,
        color: ring === 1 ? INK_SOFT : GREY,
        opacity: ring === 1 ? 0.7 : 0.45,
      });
    }
  }
  // Ejes
  for (let i = 0; i < n; i++) {
    const [x, y] = point(i, radius);
    page.drawLine({ start: { x: cx, y: cy }, end: { x, y }, thickness: 0.6, color: GREY, opacity: 0.5 });
  }
  // Polígono de puntuaciones
  const poly: number[][] = [];
  scores.forEach((s, i) => {
    const [x, y] = point(i, (radius * s.score) / 100);
    poly.push([x, y]);
  });
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!;
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1.6, color: LIME });
  }
  // Puntos y etiquetas
  scores.forEach((s, i) => {
    const [x, y] = poly[i]!;
    page.drawCircle({ x, y, size: 3, color: LIME, borderColor: BLACK, borderWidth: 0.8 });
    const [lx0, ly0] = point(i, radius + 26);
    const label = s.label;
    const value = `${s.score}`;
    const align = Math.abs(lx0 - cx) < 8 ? "center" : lx0 > cx ? "left" : "right";
    const tw = fonts.bold.widthOfTextAtSize(label, 9);
    const lx = align === "center" ? lx0 - tw / 2 : align === "left" ? lx0 : lx0 - tw;
    page.drawText(label, { x: lx, y: ly0, size: 9, font: fonts.bold, color: INK_SOFT });
    const vw = fonts.bold.widthOfTextAtSize(value, 10);
    page.drawText(value, {
      x: align === "center" ? lx0 - vw / 2 : align === "left" ? lx0 : lx0 - vw,
      y: ly0 - 13,
      size: 10,
      font: fonts.bold,
      color: BLACK,
    });
  });
}

function drawQr(page: PDFPage, url: string, x: number, y: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const modules = qr.modules;
  const cell = size / modules.size;
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.data[row * modules.size + col]) {
        page.drawRectangle({
          x: x + col * cell,
          y: y - size + row * cell,
          width: cell + 0.2,
          height: cell + 0.2,
          color: BLACK,
        });
      }
    }
  }
}

function addLink(doc: PDFDocument, page: PDFPage, rect: [number, number, number, number], uri: string) {
  try {
    const ref = doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: rect,
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(uri) },
      }),
    );
    page.node.addAnnot(ref);
  } catch {
    // El enlace visible en texto y el QR cubren el caso sin anotación.
  }
}

// ---------- Contenido condicionado a las respuestas ----------

function dependencyAnalysis(answers: AnswerMap): string[] {
  const parts: string[] = [];
  const concentration = (answers[2] ?? 0) as 0 | 1 | 2 | 3;
  const continuity = (answers[1] ?? 0) as 0 | 1 | 2 | 3;
  const hours = (answers[4] ?? 0) as 0 | 1 | 2 | 3;
  const absence = (answers[3] ?? 0) as 0 | 1 | 2 | 3;
  const growth = (answers[5] ?? 0) as 0 | 1 | 2 | 3;

  if (concentration >= 2) {
    parts.push(
      concentration === 3
        ? "Tu respuesta sobre la procedencia de tus ingresos muestra una concentración del 80% o más en una sola fuente. Esto significa que tu continuidad económica depende, en la práctica, de la permanencia de una única relación comercial o laboral, y que una decisión ajena a ti puede alterar tu situación de un mes a otro."
        : "Más de la mitad de tus ingresos proviene de una sola fuente. Aunque eso demuestra capacidad de generar valor, también significa que tu margen de negociación y tu estabilidad dependen en gran parte de esa relación.",
    );
  } else {
    parts.push(
      "Tus ingresos se distribuyen entre varias fuentes, lo que reduce el impacto de perder cualquiera de ellas y te da un margen de negociación más amplio.",
    );
  }

  if (hours >= 2 || absence >= 2) {
    parts.push(
      hours === 3
        ? "Indicaste que todos tus ingresos dependen de las horas que trabajas personalmente. Ese diseño tiene un tope natural: tu tiempo. Cada intento de crecer exige más horas, y cualquier ausencia prolongada se traduce directamente en pérdida de ingresos."
        : "Una parte importante de tus ingresos depende de tus horas personales de trabajo. Es un patrón común y comprensible, pero convierte tu tiempo en el recurso más escaso de tu modelo.",
    );
    if (absence >= 2) {
      parts.push(
        absence === 3
          ? "Además, un mes sin trabajo personal significaría prácticamente desaparecer tus ingresos: la operación completa descansa sobre ti."
          : "Un mes sin trabajo personal reduciría tus ingresos más de la mitad, lo que limita tu capacidad de descansar, enfermar o dedicar tiempo a construir alternativas.",
      );
    }
  } else {
    parts.push(
      "Tu actividad ya genera valor sin depender completamente de tus horas personales: esa es una base estructural valiosa para expandir.",
    );
  }

  if (growth >= 2) {
    parts.push(
      growth === 3
        ? "Para crecer un 50% necesitarías aumentar sustancialmente tu carga de trabajo: el modelo actual no tiene capacidad ociosa, y el crecimiento exigiría sacrificar descanso o calidad."
        : "Crecer un 50% exigiría conseguir más clientes y trabajar considerablemente más horas: el crecimiento posible hoy es, sobre todo, un crecimiento lineal.",
    );
  } else {
    parts.push(
      "Cuentas con un sistema comercial u operativo que permite crecer sin un aumento proporcional de tu carga: aprovecharlo es la vía de expansión más inmediata.",
    );
  }

  if (continuity >= 2 && concentration >= 2) {
    parts.push(
      "En conjunto, tu respaldo financiero corto y la concentración de ingresos se refuerzan: es la combinación que más conviene atender en los próximos meses.",
    );
  }
  return parts;
}

function continuityScenarios(answers: AnswerMap): string[] {
  const scenarios: string[] = [];
  if ((answers[1] ?? 0) >= 2) {
    scenarios.push(
      "Margen de reacción corto: ante una interrupción de tus ingresos principales, tu capacidad de cubrir gastos esenciales se limita a pocos meses. Continuar sin fortalecer ese colchón reduce tu margen de maniobra para tomar decisiones tranquilas.",
    );
  }
  if ((answers[2] ?? 0) >= 2) {
    scenarios.push(
      "Continuidad ligada a una sola relación: mientras tu ingreso dependa de una empresa o cliente, tu año siguiente dependerá de su ciclo, su presupuesto y su percepción de tu valor.",
    );
  }
  if ((answers[4] ?? 0) >= 2 && (answers[5] ?? 0) >= 2) {
    scenarios.push(
      "Techo estructural del modelo: si el crecimiento solo es posible trabajando más horas, continuar con el mismo diseño significa elegir entre estancarte o sobrecargarte.",
    );
  }
  if ((answers[10] ?? 0) >= 2) {
    scenarios.push(
      "Brecha tecnológica creciente: sin procesos apoyados en IA y herramientas digitales, tu costo por entrega se mantiene alto frente a colegas que ya operan con mayor eficiencia.",
    );
  }
  if ((answers[11] ?? 0) >= 2) {
    scenarios.push(
      "Exposición al cambio de sector: tus alternativas identificadas frente a un cambio significativo son limitadas, lo que hace que un movimiento del mercado te tome sin ruta preparada.",
    );
  }
  if (scenarios.length === 0) {
    scenarios.push(
      "Tu modelo muestra resiliencia relativa: colchón financiero, ingresos diversificados y capacidad de operar sin tu presencia constante. Continuar así es viable, y el reto es aprovechar esa estabilidad para construir tu siguiente etapa sin urgencia.",
    );
  }
  return scenarios.slice(0, 4);
}

function opportunities(payload: ReportPayload, answers: AnswerMap): {
  fortaleza: string;
  capacidades: string[];
  oportunidades: string[];
  riesgos: string[];
} {
  const fortaleza = dimensionVulnerability(payload.strength as never).replace(
    "todavía",
    "ya",
  );
  const capacidades: string[] = [];
  if ((answers[3] ?? 0) <= 1) capacidades.push("Tu actividad ya genera valor sin depender por completo de tu presencia diaria.");
  if ((answers[7] ?? 3) <= 1) capacidades.push("Tienes experiencia previa estructurando y validando ofertas comerciales.");
  if ((answers[9] ?? 3) <= 1) capacidades.push("Has demostrado capacidad de generar conversaciones y oportunidades comerciales por iniciativa propia.");
  if ((answers[10] ?? 3) <= 1) capacidades.push("Usas herramientas digitales e IA con regularidad, lo que acelera cualquier digitalización.");
  if ((answers[1] ?? 3) <= 1) capacidades.push("Cuentas con un colchón financiero que te da margen para construir con calma.");
  if (capacidades.length === 0) capacidades.push("Tu trayectoria acumulada y tu experiencia profesional son el activo sobre el que construir.");

  const oportunidades: string[] = [];
  const goal = payload.goal_12m;
  if (goal.startsWith("Diversificar")) oportunidades.push("Diversificar tus ingresos con un segundo flujo apoyado en tu experiencia actual.");
  else if (goal.startsWith("Crear")) oportunidades.push("Convertir tu experiencia en un negocio propio con una oferta clara y comprable.");
  else if (goal.startsWith("Escalar")) oportunidades.push("Escalar tu actividad actual ordenando procesos y capacidad de captación.");
  else if (goal.startsWith("Preparar")) oportunidades.push("Estructurar una transición ordenada hacia tu siguiente rol o modelo.");
  else if (goal.startsWith("Incorporar")) oportunidades.push("Aplicar IA a tus procesos prioritarios para ganar tiempo y capacidad.");
  else oportunidades.push("Explorar qué parte de tu experiencia tiene demanda independiente y probarla en el mercado.");

  oportunidades.push(`Fortalecer ${payload.strength.replace(/_/g, " ").toLowerCase()} y usarla como plataforma de expansión.`);
  oportunidades.push(`Avanzar por tu ruta CODE comenzando por la etapa ${payload.code_stage}.`);

  const riesgos = payload.top_dimensions.map((d) => dimensionVulnerability(d as never));

  return { fortaleza, capacidades, oportunidades, riesgos };
}


// ---------- Utilidades de maquetación ----------

const PAGE_TOP = A4[1] - 100; // primera línea útil bajo la cabecera
const PAGE_BOTTOM = 64; // margen de seguridad sobre el pie de página

function textHeight(text: string, font: PDFFont, size: number, maxWidth: number, lineHeight: number): number {
  return wrapText(text, font, size, maxWidth).length * lineHeight;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function chevron(page: PDFPage, x: number, y: number, color: ReturnType<typeof rgb>) {
  page.drawLine({ start: { x, y: y + 5 }, end: { x: x + 5, y }, thickness: 1.4, color });
  page.drawLine({ start: { x: x + 5, y }, end: { x, y: y - 5 }, thickness: 1.4, color });
}

export async function buildReportPdf(
  payload: ReportPayload,
  answers: AnswerMap,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Tu mapa de expansión profesional · Tiby Hernández");
  doc.setAuthor("Tiby Hernández");
  doc.setSubject("Diagnóstico de criticidad y oportunidades de transformación");

  const fonts: Fonts = {
    title: await doc.embedFont(StandardFonts.TimesRomanBold),
    body: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.TimesRomanItalic),
  };
  const logoCream = await doc.embedPng(base64ToBytes(LOGO_CREAM_B64));

  const date = new Date(payload.completed_at ?? Date.now());
  const dateStr = date.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  const waUrl = whatsappHref(
    `Hola, Tiby. Acabo de realizar el diagnóstico Mapa de Expansión Profesional. Mi nivel de criticidad es ${payload.level.toUpperCase()} y mi código de diagnóstico es ${payload.diagnosis_code}. Me gustaría conversar sobre las opciones de acompañamiento.`,
  );
  const M = 48;
  const W = A4[0] - M * 2;
  const levelColor = payload.overall_index >= 51 ? ORANGE : LIME;
  const labelOf = (key: string) => payload.dimension_scores.find((d) => d.key === key)?.label ?? key;

  // Página con flujo: si el contenido no cabe, continúa en una nueva hoja con la misma cabecera.
  let page: PDFPage;
  let y = 0;
  let sectionLabel = "";
  const newPage = (label: string) => {
    sectionLabel = label;
    page = doc.addPage(A4);
    header(page, doc, fonts, label, payload.diagnosis_code);
    y = PAGE_TOP;
  };
  const ensure = (h: number) => {
    if (y - h < PAGE_BOTTOM) newPage(`${sectionLabel.replace(/ \(cont\.\)$/, "")} (cont.)`);
  };
  const h2 = (text: string) => {
    ensure(40);
    page.drawText(text, { x: M, y: y - 20, size: 22, font: fonts.title, color: BLACK });
    y -= 40;
  };
  const h3 = (text: string, color = BLACK) => {
    ensure(36);
    page.drawText(text, { x: M, y: y - 12, size: 12.5, font: fonts.bold, color });
    y -= 24;
  };
  const para = (text: string, size = 10, lh = 15, color = INK_SOFT, indent = 0) => {
    const lines = wrapText(text, fonts.body, size, W - indent);
    for (const line of lines) {
      ensure(lh);
      page.drawText(line, { x: M + indent, y: y - size, size, font: fonts.body, color });
      y -= lh;
    }
  };

  // ---------- Página 1 · Portada ----------
  page = doc.addPage(A4);
  page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: BLACK });
  const coverLogoW = 210;
  const coverLogoH = (logoCream.height / logoCream.width) * coverLogoW;
  page.drawImage(logoCream, { x: M, y: A4[1] - 70 - coverLogoH, width: coverLogoW, height: coverLogoH });
  page.drawText("MAPA DE EXPANSIÓN PROFESIONAL", { x: M, y: A4[1] - 100 - coverLogoH, size: 9, font: fonts.bold, color: LIME });

  page.drawText("Tu mapa de", { x: M, y: 560, size: 46, font: fonts.title, color: CREAM });
  page.drawText("expansión", { x: M, y: 510, size: 46, font: fonts.title, color: CREAM });
  page.drawText("profesional", { x: M, y: 460, size: 46, font: fonts.title, color: LIME });
  page.drawText("Diagnóstico de criticidad y oportunidades de transformación", { x: M, y: 420, size: 14, font: fonts.italic, color: CREAM });

  // Tarjeta de datos y del índice
  const cardY = 120;
  const cardH = 220;
  page.drawRectangle({ x: M, y: cardY, width: W, height: cardH, color: rgb(0.08, 0.08, 0.08), borderColor: rgb(0.22, 0.22, 0.22), borderWidth: 0.8 });
  let cy = cardY + cardH - 34;
  page.drawText("ELABORADO PARA", { x: M + 24, y: cy, size: 8, font: fonts.bold, color: GREY });
  page.drawText(payload.lead_name || "Profesional evaluado", { x: M + 24, y: cy - 20, size: 15, font: fonts.bold, color: CREAM });
  cy -= 58;
  page.drawText("FECHA DE EVALUACIÓN", { x: M + 24, y: cy, size: 8, font: fonts.bold, color: GREY });
  page.drawText(dateStr, { x: M + 24, y: cy - 16, size: 11, font: fonts.body, color: CREAM });
  cy -= 46;
  page.drawText("CÓDIGO DEL DIAGNÓSTICO", { x: M + 24, y: cy, size: 8, font: fonts.bold, color: GREY });
  page.drawText(payload.diagnosis_code, { x: M + 24, y: cy - 16, size: 11, font: fonts.body, color: CREAM });
  // Índice a la derecha de la tarjeta
  const idxX = M + W - 190;
  page.drawLine({ start: { x: idxX - 24, y: cardY + 24 }, end: { x: idxX - 24, y: cardY + cardH - 24 }, thickness: 0.6, color: rgb(0.25, 0.25, 0.25) });
  page.drawText("ÍNDICE DE CRITICIDAD", { x: idxX, y: cardY + cardH - 34, size: 8, font: fonts.bold, color: GREY });
  const idxStr = String(payload.overall_index);
  page.drawText(idxStr, { x: idxX, y: cardY + 92, size: 78, font: fonts.title, color: levelColor });
  page.drawText("/ 100", { x: idxX + fonts.title.widthOfTextAtSize(idxStr, 78) + 8, y: cardY + 96, size: 14, font: fonts.bold, color: GREY });
  page.drawText(`Nivel ${payload.level}`, { x: idxX, y: cardY + 56, size: 15, font: fonts.bold, color: CREAM });
  page.drawText("Herramienta orientativa de reflexión estratégica.", { x: M, y: 80, size: 8, font: fonts.body, color: GREY });

  // ---------- Página 2 · Resumen ejecutivo y mapa ----------
  newPage("Resumen ejecutivo");
  h2("Tu diagnóstico en una página");
  // Banda del índice
  page.drawRectangle({ x: M, y: y - 74, width: W, height: 74, color: BLACK });
  page.drawText(idxStr, { x: M + 20, y: y - 58, size: 48, font: fonts.title, color: levelColor });
  const idxW = fonts.title.widthOfTextAtSize(idxStr, 48);
  page.drawText("/ 100", { x: M + 26 + idxW, y: y - 56, size: 12, font: fonts.bold, color: GREY });
  page.drawText("ÍNDICE GENERAL DE CRITICIDAD", { x: M + 150, y: y - 30, size: 8, font: fonts.bold, color: GREY });
  page.drawText(`Nivel ${payload.level}`, { x: M + 150, y: y - 52, size: 16, font: fonts.bold, color: LIME });
  page.drawText(`Etapa de entrada CODE: ${payload.code_stage}`, { x: M + W - 20 - fonts.body.widthOfTextAtSize(`Etapa de entrada CODE: ${payload.code_stage}`, 9), y: y - 52, size: 9, font: fonts.body, color: CREAM });
  y -= 98;

  h3("Interpretación personalizada");
  para(payload.interpretation, 9.8, 14.5);
  y -= 16;

  // Radar (izquierda) + barras (derecha)
  h3("Tus cinco dimensiones");
  const blockH = 250;
  ensure(blockH);
  const radarCx = M + 150;
  const radarCy = y - 120;
  drawRadar(page, radarCx, radarCy, 78, payload.dimension_scores.map((d) => ({ label: d.label.split(" ")[0] ?? d.label, score: d.score })), fonts);
  const barX = M + 318;
  const barW = W - 318 - 30;
  let by = y - 22;
  for (const d of payload.dimension_scores) {
    const color = d.score >= 66 ? ORANGE : d.score >= 33 ? rgb(0.85, 0.6, 0.2) : rgb(0.45, 0.7, 0.2);
    page.drawText(d.label, { x: barX, y: by, size: 8.5, font: fonts.body, color: INK_SOFT });
    page.drawRectangle({ x: barX, y: by - 14, width: barW, height: 7, color: CREAM, borderColor: GREY, borderWidth: 0.4 });
    page.drawRectangle({ x: barX, y: by - 14, width: (d.score / 100) * barW, height: 7, color });
    page.drawText(`${d.score}`, { x: barX + barW + 8, y: by - 14, size: 9, font: fonts.bold, color: BLACK });
    by -= 40;
  }
  y -= blockH;

  // Fortaleza y vulnerabilidad en dos tarjetas
  const colW = (W - 16) / 2;
  const strengthText = `${labelOf(payload.strength)}: es la dimensión con menor criticidad de tu diagnóstico y la base sobre la que puedes apoyar tu transformación.`;
  const vulnText = `${labelOf(payload.top_dimensions[0] ?? "")}: ${dimensionVulnerability(payload.top_dimensions[0] as never)}`;
  const cardTextH = Math.max(
    textHeight(strengthText, fonts.body, 9.3, colW - 28, 13.5),
    textHeight(vulnText, fonts.body, 9.3, colW - 28, 13.5),
  );
  const twoCardH = cardTextH + 52;
  ensure(twoCardH);
  const drawCard = (x: number, title: string, text: string, accent: ReturnType<typeof rgb>) => {
    page.drawRectangle({ x, y: y - twoCardH, width: colW, height: twoCardH, color: CREAM });
    page.drawRectangle({ x, y: y - twoCardH, width: 4, height: twoCardH, color: accent });
    page.drawText(title, { x: x + 16, y: y - 26, size: 11, font: fonts.bold, color: BLACK });
    let ty = y - 44;
    for (const line of wrapText(text, fonts.body, 9.3, colW - 28)) {
      page.drawText(line, { x: x + 16, y: ty, size: 9.3, font: fonts.body, color: INK_SOFT });
      ty -= 13.5;
    }
  };
  drawCard(M, "Fortaleza relativa", strengthText, rgb(0.45, 0.7, 0.2));
  drawCard(M + colW + 16, "Principal vulnerabilidad", vulnText, ORANGE);
  y -= twoCardH;

  // ---------- Página 3 · Dependencia, alertas y continuidad ----------
  newPage("Análisis de dependencia");
  h2("Cómo se sostiene tu modelo actual");
  for (const p of dependencyAnalysis(answers)) {
    para(p, 9.5, 13.8);
    y -= 6;
  }
  y -= 8;

  h3("Alertas relevantes", ORANGE);
  if (payload.alerts.length === 0) {
    para("No se activaron alertas específicas en este diagnóstico. Mantén tus prácticas actuales y revisa el índice periódicamente.", 9.8, 14.5);
  } else {
    // Alertas en cuadrícula de dos columnas
    const aW = (W - 12) / 2;
    for (let i = 0; i < payload.alerts.length; i += 2) {
      const pair = payload.alerts.slice(i, i + 2);
      const h = Math.max(...pair.map((a) => textHeight(a.description, fonts.body, 8.6, aW - 30, 12))) + 34;
      ensure(h + 10);
      pair.forEach((alert, j) => {
        const x = M + j * (aW + 12);
        page.drawRectangle({ x, y: y - h, width: aW, height: h, color: CREAM });
        page.drawRectangle({ x, y: y - h, width: 4, height: h, color: ORANGE });
        page.drawText(alert.title, { x: x + 16, y: y - 17, size: 10, font: fonts.bold, color: BLACK });
        let ty = y - 31;
        for (const line of wrapText(alert.description, fonts.body, 8.6, aW - 30)) {
          page.drawText(line, { x: x + 16, y: ty, size: 8.6, font: fonts.body, color: INK_SOFT });
          ty -= 12;
        }
      });
      y -= h + 10;
    }
  }
  y -= 12;

  h3("Qué implica continuar con tu modelo actual");
  ensure(20);
  page.drawText("Tendencias a observar derivadas de tus respuestas, no predicciones.", { x: M, y: y - 10, size: 10, font: fonts.italic, color: GREY });
  y -= 24;
  for (const s of continuityScenarios(answers)) {
    ensure(30);
    page.drawCircle({ x: M + 4, y: y - 6, size: 2.6, color: ORANGE });
    const lines = wrapText(s, fonts.body, 9.3, W - 18);
    for (const line of lines) {
      ensure(13.5);
      page.drawText(line, { x: M + 16, y: y - 9.3, size: 9.3, font: fonts.body, color: INK_SOFT });
      y -= 13.5;
    }
    y -= 5;
  }

  // ---------- Página 4 · Oportunidades y ruta CODE ----------
  newPage("Oportunidades y ruta CODE");
  h2("Tu potencial de transformación");
  const opp = opportunities(payload, answers);
  opp.fortaleza = `${labelOf(payload.strength)} es tu dimensión más sólida: úsala como punto de apoyo para tu siguiente etapa.`;
  opp.oportunidades = opp.oportunidades.map((o) =>
    o.startsWith("Fortalecer") ? `Fortalecer tu ${labelOf(payload.strength).toLowerCase()} y usarla como plataforma de expansión.` : o,
  );
  const grid: [string, ReturnType<typeof rgb>, string[]][] = [
    ["Fortaleza principal", rgb(0.45, 0.7, 0.2), [opp.fortaleza]],
    ["Capacidades aprovechables", rgb(0.45, 0.7, 0.2), opp.capacidades],
    ["Oportunidades identificadas", BLACK, opp.oportunidades],
    ["Riesgos que conviene reducir", ORANGE, opp.riesgos],
  ];
  const gW = (W - 16) / 2;
  const itemsH = (items: string[]) => items.reduce((acc, it) => acc + textHeight(it, fonts.body, 9, gW - 40, 12.5) + 6, 0);
  for (let row = 0; row < 2; row++) {
    const a = grid[row * 2]!;
    const b = grid[row * 2 + 1]!;
    const h = Math.max(itemsH(a[2]), itemsH(b[2])) + 44;
    ensure(h + 12);
    [a, b].forEach(([title, accent, items], i) => {
      const x = M + i * (gW + 16);
      page.drawRectangle({ x, y: y - h, width: gW, height: h, color: CREAM });
      page.drawRectangle({ x, y: y - 4, width: gW, height: 4, color: accent });
      page.drawText(title, { x: x + 16, y: y - 26, size: 10.5, font: fonts.bold, color: accent === BLACK ? BLACK : accent });
      let ty = y - 42;
      for (const it of items) {
        page.drawCircle({ x: x + 19, y: ty + 3, size: 2, color: accent });
        for (const line of wrapText(it, fonts.body, 9, gW - 40)) {
          page.drawText(line, { x: x + 28, y: ty, size: 9, font: fonts.body, color: INK_SOFT });
          ty -= 12.5;
        }
        ty -= 6;
      }
    });
    y -= h + 12;
  }
  y -= 14;

  h2("Tu ruta CODE");
  const entry = payload.code_stage;
  const gap = 16;
  const boxW = (W - 3 * gap) / 4;
  const boxH = 110;
  ensure(boxH + 10);
  let bx = M;
  for (const stage of CODE_STAGES) {
    const isEntry = stage.key === entry;
    page.drawRectangle({ x: bx, y: y - boxH, width: boxW, height: boxH, color: isEntry ? BLACK : CREAM });
    if (isEntry) page.drawText("ETAPA DE ENTRADA", { x: bx + 12, y: y - 16, size: 6.5, font: fonts.bold, color: LIME });
    page.drawText(stage.letter, { x: bx + 12, y: y - 46, size: 26, font: fonts.title, color: isEntry ? LIME : INK_SOFT });
    page.drawText(stage.title, { x: bx + 12, y: y - 64, size: 10.5, font: fonts.bold, color: isEntry ? CREAM : BLACK });
    let dy = y - 78;
    for (const line of wrapText(stage.description, fonts.body, 7.5, boxW - 22).slice(0, 4)) {
      page.drawText(line, { x: bx + 12, y: dy, size: 7.5, font: fonts.body, color: isEntry ? CREAM : INK_SOFT });
      dy -= 9.5;
    }
    if (stage.key !== "Escalar") chevron(page, bx + boxW + 5, y - boxH / 2, GREY);
    bx += boxW + gap;
  }
  y -= boxH + 20;
  const entryText: Record<string, string> = {
    Convertir:
      "Tu diagnóstico muestra que el paso con mayor palanca es transformar tu experiencia en una oferta concreta y comercializable. Sin una oferta definida, las demás etapas carecen de material que ordenar o escalar.",
    Ordenar:
      "Ya tienes una propuesta en marcha; lo que falta es estructura comercial: cliente definido, precios, alcance y modelo de negocio. Ordenar ese material multiplica el valor de lo que ya construiste.",
    Digitalizar:
      "Tu oferta y tu operación existen; el siguiente salto viene de aplicar tecnología e IA a tus procesos prioritarios para ganar tiempo, capacidad y consistencia.",
    Escalar:
      "Cuentas con oferta validada y estructura operativa; tu palanca está en la generación sistemática de oportunidades, ventas y capacidad de crecimiento.",
  };
  h3(`Tu punto de entrada: ${entry}`, ORANGE);
  para(entryText[entry] ?? "", 9.8, 14.5);
  y -= 6;
  para(
    "La ruta no supone recorrer las cuatro etapas de forma idéntica: el acompañamiento se diseña con etapas prioritarias y complementarias según tu diagnóstico y tus objetivos.",
    8.8,
    12.5,
    GREY,
  );

  y -= 18;
  h3("Qué mide el índice");
  para(
    "El índice combina cinco dimensiones ponderadas: exposición financiera (25%), dependencia operativa (25%), capitalización del conocimiento (20%), adaptación profesional y tecnológica (15%) y preparación para la expansión (15%). Cada dimensión se normaliza de 0 a 100 a partir de tus respuestas. Los umbrales son iniciales y orientativos: no constituyen una escala científicamente validada ni una predicción de resultados futuros.",
    8.8,
    12.5,
    GREY,
  );

  // ---------- Página 5 · Plan de acción ----------
  newPage("Plan de acción · 30 días");
  h2("Tres acciones prioritarias");
  const labelCol = 112;
  payload.priority_actions.forEach((action, i) => {
    const rows: [string, string][] = [
      ["Objetivo", action.objective],
      ["Actividad", action.activity],
      ["Resultado esperado", action.expected],
      ["Indicador", action.indicator],
    ];
    const valueW = W - 32 - labelCol;
    const rowsH = rows.reduce((acc, [, v]) => acc + textHeight(v, fonts.body, 9.3, valueW, 13) + 8, 0);
    const h = rowsH + 60;
    ensure(h + 14);
    page.drawRectangle({ x: M, y: y - h, width: W, height: h, color: CREAM });
    // Insignia numerada
    page.drawRectangle({ x: M + 16, y: y - 42, width: 26, height: 26, color: BLACK });
    const num = String(i + 1);
    page.drawText(num, { x: M + 29 - fonts.bold.widthOfTextAtSize(num, 13) / 2, y: y - 34, size: 13, font: fonts.bold, color: LIME });
    page.drawText(action.title, { x: M + 54, y: y - 34, size: 12.5, font: fonts.bold, color: BLACK });
    let ry = y - 62;
    for (const [label, value] of rows) {
      page.drawText(label, { x: M + 16, y: ry, size: 8.8, font: fonts.bold, color: ORANGE });
      for (const line of wrapText(value, fonts.body, 9.3, valueW)) {
        page.drawText(line, { x: M + 16 + labelCol, y: ry, size: 9.3, font: fonts.body, color: INK_SOFT });
        ry -= 13;
      }
      ry -= 8;
    }
    y -= h + 14;
  });

  // ---------- Página 6 · Invitación estratégica ----------
  page = doc.addPage(A4);
  page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: BLACK });
  const endLogoW = 170;
  const endLogoH = (logoCream.height / logoCream.width) * endLogoW;
  page.drawImage(logoCream, { x: M, y: A4[1] - 70 - endLogoH, width: endLogoW, height: endLogoH });
  let iy = A4[1] - 130 - endLogoH;
  page.drawText("Tu siguiente etapa", { x: M, y: iy, size: 34, font: fonts.title, color: CREAM });
  page.drawText("merece una estrategia", { x: M, y: iy - 40, size: 34, font: fonts.title, color: LIME });
  iy -= 80;
  iy = drawParagraph(
    page,
    "Tu trayectoria reúne conocimientos y experiencias que pueden convertirse en nuevas oportunidades profesionales y comerciales. El siguiente paso es construir un modelo alineado con tus capacidades, objetivos y realidad actual.",
    { font: fonts.body, size: 11, x: M, y: iy, maxWidth: W, color: CREAM, lineHeight: 17 },
  );
  iy -= 18;
  page.drawText("Sobre Tiby Hernández", { x: M, y: iy, size: 12, font: fonts.bold, color: LIME });
  iy -= 20;
  iy = drawParagraph(
    page,
    "Consultora y mentora. Acompaño a profesionales con trayectoria a estructurar su conocimiento, definir cómo ofrecerlo y desarrollar su siguiente etapa. Y acompaño a empresas y equipos en la adopción estratégica de IA.",
    { font: fonts.body, size: 10.5, x: M, y: iy, maxWidth: W, color: CREAM, lineHeight: 16 },
  );
  iy -= 26;

  // Tarjeta de contacto con botón y QR alineados
  const qrSize = 120;
  const ctaH = qrSize + 40;
  const ctaY = iy - ctaH;
  page.drawRectangle({ x: M, y: ctaY, width: W, height: ctaH, color: rgb(0.08, 0.08, 0.08), borderColor: rgb(0.22, 0.22, 0.22), borderWidth: 0.8 });
  const qrX = M + W - 20 - qrSize;
  const qrTop = ctaY + ctaH - 20;
  page.drawRectangle({ x: qrX - 8, y: qrTop - qrSize - 8, width: qrSize + 16, height: qrSize + 16, color: CREAM });
  drawQr(page, waUrl, qrX, qrTop, qrSize);
  addLink(doc, page, [qrX - 8, qrTop - qrSize - 8, qrX + qrSize + 8, qrTop + 8], waUrl);
  const ctaTextW = W - qrSize - 80;
  page.drawText("Solicita una conversación estratégica", { x: M + 22, y: ctaY + ctaH - 36, size: 13, font: fonts.bold, color: CREAM });
  drawParagraph(page, "Escríbeme por WhatsApp o escanea el código. Tu mensaje llega con tu código de diagnóstico.", {
    font: fonts.body, size: 9.8, x: M + 22, y: ctaY + ctaH - 58, maxWidth: ctaTextW, color: GREY, lineHeight: 14,
  });
  const btnLabel = "Escribir por WhatsApp: +57 313 465 4162";
  const btnW = fonts.bold.widthOfTextAtSize(btnLabel, 10) + 32;
  const btnY = ctaY + 24;
  page.drawRectangle({ x: M + 22, y: btnY, width: btnW, height: 30, color: LIME });
  page.drawText(btnLabel, { x: M + 38, y: btnY + 10, size: 10, font: fonts.bold, color: BLACK });
  addLink(doc, page, [M + 22, btnY, M + 22 + btnW, btnY + 30], waUrl);

  page.drawText(`Código de diagnóstico: ${payload.diagnosis_code}`, { x: M, y: 72, size: 9, font: fonts.body, color: GREY });
  page.drawText(`Emitido el ${dateStr} · Tiby Hernández · Mapa de Expansión Profesional`, { x: M, y: 56, size: 9, font: fonts.body, color: GREY });

  return doc.save();
}
