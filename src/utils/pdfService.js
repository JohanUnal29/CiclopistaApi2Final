import axios from "axios";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";

pdfMake.vfs = pdfFonts.pdfMake.vfs;

// Helpers
const safe = (v) => (v === null || v === undefined || v === "" ? "N/A" : String(v));

/**
 * Descarga una imagen por URL y la devuelve en base64 (sin el prefix data:)
 * - timeout evita cuelgues
 * - si falla devuelve null
 */
const loadImageBase64 = async (url, timeoutMs = 4000) => {
  try {
    if (!url) return null;
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: timeoutMs,
      // opcional: headers, si algún host lo requiere
      // headers: { "User-Agent": "Mozilla/5.0" },
      validateStatus: (s) => s >= 200 && s < 300,
    });
    return Buffer.from(res.data).toString("base64");
  } catch {
    return null;
  }
};

/**
 * ✅ Genera el PDF del ticket como Buffer (NO crea carpeta, NO guarda archivos)
 * - Descarga logo + imágenes del carrito en paralelo
 * - Timeouts por imagen para evitar cuelgues en producción
 * @returns {Promise<Buffer>}
 */
const generarPDF = async (ticketDTO) => {
  // 🔧 Ajustes recomendados
  const IMAGE_TIMEOUT_MS = 4000;
  const MAX_PRODUCT_IMAGES = 12; // limita para que no pese demasiado (ajústalo)

  // Logo por URL
  const logoUrl =
    "https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Fcplogo%20rojo%20registrado%20R%20m%C3%A1s%20grande%20(1).png?alt=media&token=68739185-9438-4bf9-ac31-9b43b3fa9c87";

  const cartRaw = Array.isArray(ticketDTO?.cart) ? ticketDTO.cart : [];
  const cart = cartRaw.slice(0, MAX_PRODUCT_IMAGES);

  // ✅ Descargar logo y todas las imágenes del carrito en paralelo
  const [logoBase64, ...cartImagesBase64] = await Promise.all([
    loadImageBase64(logoUrl, IMAGE_TIMEOUT_MS),
    ...cart.map((item) => loadImageBase64(item?.image, IMAGE_TIMEOUT_MS)),
  ]);

  // Tabla base
  const tableBody = [
    [
      { text: "Imagen", style: "tableHeader" },
      { text: "Producto", style: "tableHeader" },
      { text: "Código", style: "tableHeader" },
      { text: "Cantidad", style: "tableHeader" },
      { text: "Precio", style: "tableHeader" },
    ],
  ];

  // Filas
  cart.forEach((item, idx) => {
    const imgB64 = cartImagesBase64[idx];

    tableBody.push([
      imgB64
        ? { image: "data:image/png;base64," + imgB64, fit: [50, 50] }
        : { text: "Sin imagen", color: "#777" },
      safe(item?.title),
      safe(item?.code),
      safe(item?.quantity ?? item?.cantidad), // por si a veces llega con otro nombre
      safe(item?.price),
    ]);
  });

  // Documento pdfmake
  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 40],
    content: [
      // Logo arriba (si cargó)
      ...(logoBase64
        ? [
            {
              image: "data:image/png;base64," + logoBase64,
              fit: [120, 60],
              alignment: "right",
              margin: [0, 0, 0, 10],
            },
          ]
        : []),

      { text: "Detalles del Ticket", style: "header", margin: [0, 0, 0, 10] },

      { text: [{ text: "Código: ", style: "bold" }, safe(ticketDTO?.code)] },
      {
        text: [
          { text: "Fecha: ", style: "bold" },
          safe(ticketDTO?.purchase_datetime),
        ],
      },
      { text: [{ text: "Nombre: ", style: "bold" }, safe(ticketDTO?.name)] },
      {
        text: [
          { text: "Documento: ", style: "bold" },
          safe(ticketDTO?.identification_document),
        ],
      },
      {
        text: [{ text: "Comprador: ", style: "bold" }, safe(ticketDTO?.purchaser)],
      },
      { text: [{ text: "Teléfono: ", style: "bold" }, safe(ticketDTO?.phone)] },
      { text: [{ text: "Mensaje: ", style: "bold" }, safe(ticketDTO?.message)] },
      {
        text: [
          { text: "Departamento: ", style: "bold" },
          safe(ticketDTO?.departamento),
        ],
      },
      {
        text: [
          { text: "Ciudad o Municipio: ", style: "bold" },
          safe(ticketDTO?.ciudad_o_municipio),
        ],
      },
      { text: [{ text: "Barrio: ", style: "bold" }, safe(ticketDTO?.barrio)] },
      {
        text: [{ text: "Dirección: ", style: "bold" }, safe(ticketDTO?.direccion)],
      },
      {
        text: [
          { text: "Referencias de entrega: ", style: "bold" },
          safe(ticketDTO?.referencias_entrega),
        ],
      },

      {
        text: [
          { text: "Monto Total: $", color: "red", style: "bold" },
          { text: safe(ticketDTO?.amount), color: "red" },
        ],
        margin: [0, 10, 0, 10],
      },

      { text: "Productos en el carrito", style: "subheader" },

      {
        table: {
          headerRows: 1,
          widths: [100, "*", "auto", "auto", "auto"],
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex) => (rowIndex === 0 ? "#CCCCCC" : null),
        },
        margin: [0, 10, 0, 10],
      },

      ...(cartRaw.length > MAX_PRODUCT_IMAGES
        ? [
            {
              text: `Nota: se muestran los primeros ${MAX_PRODUCT_IMAGES} productos de ${cartRaw.length}.`,
              fontSize: 10,
              color: "#666",
              margin: [0, 8, 0, 0],
            },
          ]
        : []),
    ],

    styles: {
      header: { fontSize: 20, bold: true, alignment: "center" },
      subheader: { fontSize: 16, bold: true, margin: [0, 10, 0, 5] },
      bold: { bold: true },
      tableHeader: { bold: true },
    },

    defaultStyle: { fontSize: 11 },
  };

  // ✅ pdfmake -> Buffer
  return await new Promise((resolve, reject) => {
    try {
      const pdfDoc = pdfMake.createPdf(docDefinition);
      pdfDoc.getBase64((b64) => resolve(Buffer.from(b64, "base64")));
    } catch (err) {
      reject(err);
    }
  });
};

export default generarPDF;
