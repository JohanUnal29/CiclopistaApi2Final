import axios from "axios";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";

pdfMake.vfs = pdfFonts.pdfMake.vfs;

/* =========================
   HELPERS
========================= */

// Solo lo usamos para el logo (1 imagen). El carrito ya NO descarga imágenes.
const loadImage = async (url) => {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 8000,
    });

    const contentType = res.headers?.["content-type"] || "image/png";
    const b64 = Buffer.from(res.data).toString("base64");

    return { b64, contentType };
  } catch {
    return null;
  }
};

const formatMoney = (value, currency = "COP") => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "N/A";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
};

const formatFechaCO = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return String(isoString);

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
};

const statusConfig = (status) => {
  const s = String(status || "unknown").toLowerCase();
  if (s === "approved")
    return { label: "APROBADO", color: "#1e7a3a", bg: "#e8fff1" };
  if (s === "pending" || s === "in_process")
    return { label: "PENDIENTE", color: "#8a5b00", bg: "#fff8e6" };
  if (s === "rejected" || s === "cancelled")
    return { label: "RECHAZADO", color: "#a81818", bg: "#ffecec" };
  return { label: s.toUpperCase(), color: "#2b3a8f", bg: "#eef2ff" };
};

const mensajeEstado = (status) => {
  const s = String(status || "unknown").toLowerCase();
  if (s === "approved")
    return "¡Gracias por tu compra y por confiar en nosotros!. Tu pago fue aprobado correctamente y tu pedido ya está en proceso.";
  if (s === "pending" || s === "in_process")
    return "Tu pago se encuentra en revisión. Esto puede tardar unos minutos. Si tienes dudas, contáctanos por WhatsApp.";
  if (s === "rejected" || s === "cancelled")
    return "Tu pago no pudo ser procesado. Revisa tu medio de pago o intenta nuevamente. Si el problema persiste, contáctanos por WhatsApp.";
  return "Estamos procesando la información de tu pago. Si necesitas ayuda, contáctanos por WhatsApp.";
};

const safe = (v) =>
  v === null || v === undefined || v === "" ? "N/A" : String(v);

/* =========================
   GENERADOR PDF (COMPROBANTE) - EN MEMORIA (BUFFER)
========================= */

/**
 * ✅ Genera el comprobante como Buffer (NO crea carpetas, NO guarda en disco)
 * - Mantiene estética original
 * - ✅ Incluye TODOS los productos
 * - ✅ SIN imágenes en la tabla del carrito (para que sea liviano y estable en webhook)
 * @returns {Promise<Buffer>}
 */
const generarComprobantePagoPDF = (pago, ticket) => {
  return new Promise(async (resolve, reject) => {
    try {
      const ui = statusConfig(pago?.estado);
      const fechaBonita = formatFechaCO(pago?.fecha);

      const logoUrl =
        pago?.logoUrl ||
        "https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Fcplogo%20rojo%20registrado%20R%20m%C3%A1s%20grande%20(1).png?alt=media&token=68739185-9438-4bf9-ac31-9b43b3fa9c87";

      // Solo logo (1 request). Carrito sin imágenes.
      const logo = await loadImage(logoUrl);
      const logoDataUrl = logo
        ? `data:${logo.contentType};base64,${logo.b64}`
        : null;

      // ===== Tabla carrito (SIN imágenes, pero con TODOS los productos) =====
      const cart = Array.isArray(ticket?.cart) ? ticket.cart : [];

      const cartTableBody = [
        [
          { text: "Producto", style: "tableHeader" },
          { text: "Código", style: "tableHeader" },
          { text: "Cant.", style: "tableHeader" },
          { text: "Precio", style: "tableHeader" },
        ],
      ];

      for (const item of cart) {
        cartTableBody.push([
          { text: safe(item?.title), style: "cell" },
          { text: safe(item?.code), style: "cell" },
          { text: safe(item?.quantity), style: "cellCenter" },
          {
            text: formatMoney(item?.price, pago?.moneda || "COP"),
            style: "cellRight",
          },
        ]);
      }

      const docDefinition = {
        pageSize: "A4",
        pageMargins: [40, 40, 40, 40],

        content: [
          {
            columns: [
              logoDataUrl
                ? { image: logoDataUrl, fit: [140, 60] }
                : { text: "Ciclopista", style: "brandFallback" },
              {
                stack: [
                  { text: "COMPROBANTE", style: "rightTitle" },
                  { text: "Pago + Detalles de la orden", style: "rightSubtitle" },
                  {
                    text: fechaBonita ? `Fecha: ${fechaBonita}` : "",
                    style: "rightMeta",
                  },
                ],
                alignment: "right",
              },
            ],
            margin: [0, 0, 0, 12],
          },

          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: ui.label,
                    alignment: "center",
                    color: ui.color,
                    fillColor: ui.bg,
                    bold: true,
                    fontSize: 15,
                    margin: [0, 9, 0, 9],
                  },
                ],
              ],
            },
            layout: { hLineColor: () => "#ffffff", vLineColor: () => "#ffffff" },
            margin: [0, 0, 0, 10],
          },

          {
            text: mensajeEstado(pago?.estado),
            style: "paragraph",
            margin: [0, 0, 0, 12],
          },

          { text: "Resumen del pago", style: "sectionTitle", margin: [0, 0, 0, 6] },
          {
            table: {
              widths: [170, "*"],
              body: [
                [{ text: "Serial de la orden", style: "k" }, { text: safe(pago?.serialOrden), style: "v" }],
                [{ text: "Referencia Mercado Pago", style: "k" }, { text: safe(pago?.referenciaMp), style: "v" }],
                [{ text: "Monto", style: "k" }, { text: formatMoney(pago?.monto, pago?.moneda), style: "vAmount" }],
                [{ text: "Medio de pago", style: "k" }, { text: safe(pago?.medioPago), style: "v" }],
                [{ text: "Detalle", style: "k" }, { text: safe(pago?.detalleEstado), style: "v" }],
              ],
            },
            layout: {
              hLineColor: () => "#eaeaea",
              vLineColor: () => "#eaeaea",
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 8,
              paddingBottom: () => 8,
            },
            margin: [0, 0, 0, 12],
          },

          { text: "Detalles de la orden", style: "sectionTitle", margin: [0, 0, 0, 6] },
          {
            table: {
              widths: [170, "*"],
              body: [
                [{ text: "Código", style: "k" }, { text: safe(ticket?.code), style: "v" }],
                [{ text: "Fecha de compra", style: "k" }, { text: safe(ticket?.purchase_datetime), style: "v" }],
                [{ text: "Nombre", style: "k" }, { text: safe(ticket?.name), style: "v" }],
                [{ text: "Documento", style: "k" }, { text: safe(ticket?.identification_document), style: "v" }],
                [{ text: "Comprador", style: "k" }, { text: safe(ticket?.purchaser), style: "v" }],
                [{ text: "Teléfono", style: "k" }, { text: safe(ticket?.phone), style: "v" }],
                ...(pago?.email
                  ? [[{ text: "Email", style: "k" }, { text: safe(pago?.email), style: "v" }]]
                  : []),
              ],
            },
            layout: {
              hLineColor: () => "#eaeaea",
              vLineColor: () => "#eaeaea",
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 8,
              paddingBottom: () => 8,
            },
            margin: [0, 0, 0, 12],
          },

          { text: "Dirección de entrega", style: "sectionTitle", margin: [0, 0, 0, 6] },
          {
            table: {
              widths: [170, "*"],
              body: [
                [{ text: "Departamento", style: "k" }, { text: safe(ticket?.departamento), style: "v" }],
                [{ text: "Ciudad / Municipio", style: "k" }, { text: safe(ticket?.ciudad_o_municipio), style: "v" }],
                [{ text: "Barrio", style: "k" }, { text: safe(ticket?.barrio), style: "v" }],
                [{ text: "Dirección", style: "k" }, { text: safe(ticket?.direccion), style: "v" }],
                [{ text: "Referencias", style: "k" }, { text: safe(ticket?.referencias_entrega), style: "v" }],
                [{ text: "Mensaje", style: "k" }, { text: safe(ticket?.message), style: "v" }],
                [{ text: "Monto total orden", style: "k" }, { text: safe(ticket?.amount), style: "vAmount" }],
                [{ text: "Estado pago (DB)", style: "k" }, { text: safe(ticket?.statusPay), style: "v" }],
              ],
            },
            layout: {
              hLineColor: () => "#eaeaea",
              vLineColor: () => "#eaeaea",
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 8,
              paddingBottom: () => 8,
            },
            margin: [0, 0, 0, 12],
          },

          { text: "Productos en el carrito", style: "sectionTitle", margin: [0, 0, 0, 6] },
          cart.length
            ? {
                table: {
                  headerRows: 1,
                  widths: ["*", 70, 40, 70],
                  body: cartTableBody,
                },
                layout: {
                  fillColor: (rowIndex) => (rowIndex === 0 ? "#f2f2f2" : null),
                  hLineColor: () => "#eaeaea",
                  vLineColor: () => "#eaeaea",
                  paddingLeft: () => 8,
                  paddingRight: () => 8,
                  paddingTop: () => 6,
                  paddingBottom: () => 6,
                },
                margin: [0, 0, 0, 14],
              }
            : { text: "No hay productos en el carrito.", style: "muted", margin: [0, 0, 0, 14] },

          {
            text: "Este comprobante es informativo y se genera automáticamente.",
            style: "footerNote",
            margin: [0, 10, 0, 0],
          },
        ],

        styles: {
          brandFallback: { fontSize: 18, bold: true, color: "#d32f2f" },

          rightTitle: { fontSize: 13, bold: true, color: "#333" },
          rightSubtitle: { fontSize: 11, color: "#666", margin: [0, 2, 0, 0] },
          rightMeta: { fontSize: 9, color: "#777", margin: [0, 6, 0, 0] },

          paragraph: { fontSize: 11, color: "#333", lineHeight: 1.25 },
          sectionTitle: { fontSize: 12, bold: true, color: "#333" },

          k: { fontSize: 10, bold: true, color: "#666" },
          v: { fontSize: 10, color: "#111" },
          vAmount: { fontSize: 11, bold: true, color: "#d32f2f" },

          tableHeader: { fontSize: 10, bold: true, color: "#333" },
          cell: { fontSize: 9, color: "#111" },
          cellCenter: { fontSize: 9, alignment: "center", color: "#111" },
          cellRight: { fontSize: 9, alignment: "right", color: "#111" },
          muted: { fontSize: 9, color: "#777" },

          footerNote: { fontSize: 9, color: "#777" },
        },
      };

      const pdfDoc = pdfMake.createPdf(docDefinition);

      // ✅ No escribir archivo, devolver Buffer
      pdfDoc.getBase64((b64) => {
        try {
          resolve(Buffer.from(b64, "base64"));
        } catch (e) {
          reject(e);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
};

export default generarComprobantePagoPDF;
