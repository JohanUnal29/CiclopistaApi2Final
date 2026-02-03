import axios from "axios";
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";

pdfMake.vfs = pdfFonts.pdfMake.vfs;

// Imagen desde URL -> base64 (pdfmake)
const loadImage = async (url) => {
  try {
    if (!url) return null;
    const res = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(res.data, "binary").toString("base64");
  } catch {
    return null;
  }
};

const safe = (v) => (v === null || v === undefined || v === "" ? "N/A" : String(v));

/**
 * ✅ Genera el PDF del ticket como Buffer (NO crea carpeta, NO guarda archivos)
 * @returns {Promise<Buffer>}
 */
const generarPDF = (ticketDTO) => {
  return new Promise(async (resolve, reject) => {
    try {
      // ✅ Logo por URL (recomendado: no dependes de /logo/cplogo.png)
      const logoUrl =
        "https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Fcplogo%20rojo%20registrado%20R%20m%C3%A1s%20grande%20(1).png?alt=media&token=68739185-9438-4bf9-ac31-9b43b3fa9c87";

      const logoBase64 = await loadImage(logoUrl);

      const cart = Array.isArray(ticketDTO?.cart) ? ticketDTO.cart : [];

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

      // Cargar imágenes y filas
      for (const item of cart) {
        const imgB64 = await loadImage(item?.image);

        tableBody.push([
          imgB64
            ? { image: "data:image/png;base64," + imgB64, fit: [50, 50] }
            : { text: "Sin imagen", color: "#777" },
          safe(item?.title),
          safe(item?.code),
          safe(item?.quantity),
          safe(item?.price),
        ]);
      }

      const docDefinition = {
        pageSize: "A4",
        pageMargins: [40, 40, 40, 40],
        content: [
          // Logo arriba (si carga)
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
          { text: [{ text: "Fecha: ", style: "bold" }, safe(ticketDTO?.purchase_datetime)] },
          { text: [{ text: "Nombre: ", style: "bold" }, safe(ticketDTO?.name)] },
          { text: [{ text: "Documento: ", style: "bold" }, safe(ticketDTO?.identification_document)] },
          { text: [{ text: "Comprador: ", style: "bold" }, safe(ticketDTO?.purchaser)] },
          { text: [{ text: "Teléfono: ", style: "bold" }, safe(ticketDTO?.phone)] },
          { text: [{ text: "Mensaje: ", style: "bold" }, safe(ticketDTO?.message)] },
          { text: [{ text: "Departamento: ", style: "bold" }, safe(ticketDTO?.departamento)] },
          { text: [{ text: "Ciudad o Municipio: ", style: "bold" }, safe(ticketDTO?.ciudad_o_municipio)] },
          { text: [{ text: "Barrio: ", style: "bold" }, safe(ticketDTO?.barrio)] },
          { text: [{ text: "Dirección: ", style: "bold" }, safe(ticketDTO?.direccion)] },
          { text: [{ text: "Referencias de entrega: ", style: "bold" }, safe(ticketDTO?.referencias_entrega)] },

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
            margin: [0, 10, 0, 10],
          },
        ],

        styles: {
          header: { fontSize: 20, bold: true, alignment: "center" },
          subheader: { fontSize: 16, bold: true, margin: [0, 10, 0, 5] },
          bold: { bold: true },
          tableHeader: { bold: true, fillColor: "#CCCCCC" },
        },

        defaultStyle: { fontSize: 11 },
      };

      // ✅ Generar PDF y devolver Buffer (sin escribir archivo)
      const pdfDoc = pdfMake.createPdf(docDefinition);
      pdfDoc.getBase64((b64) => {
        resolve(Buffer.from(b64, "base64"));
      });
    } catch (err) {
      reject(err);
    }
  });
};

export default generarPDF;
