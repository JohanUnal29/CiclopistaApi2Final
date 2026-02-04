import { v4 as uuidv4 } from "uuid";
import { ticketService } from "../DAO/mongo/services/tickets.service.js";
import { productService } from "../DAO/mongo/services/products.service.js";
import ticketsModel from "../DAO/mongo/models/tickets.model.js";
import TicketDTO from "../DAO/DTO/tickets.dto.js";
import CustomError from "../DAO/mongo/services/errors/custom-error.js";
import EErros from "../DAO/mongo/services/errors/enum.js";
import crypto from "crypto";
import { entorno } from "../config.js";
import { sendEmailWithPdfResend } from "../utils/emailResend.js";

console.log(entorno.ACCESS_TOKE_MELI)

const client = new MercadoPagoConfig({
  accessToken: `${entorno.ACCESS_TOKE_MELI}`,
})



import generarPDF from "../utils/pdfService.js";
import generarComprobantePagoPDF from "../utils/pdfPayService.js";
import { MercadoPagoConfig } from "mercadopago";



class TicketController {
  async getTickets(req, res) {
    try {
      const tickets = await ticketService.getTickets();

      if (!tickets) {
        CustomError.createError({
          name: "Error-tickets",
          cause: "Tickets was not found",
          message: "Tickets was not found",
          code: EErros.DATABASES_READ_ERROR,
        });

        req.logger.error({
          message: "Tickets was not found",
          Date: new Date().toLocaleTimeString(),
        });
      }

      return res.send({
        status: "success",
        message: "ticket found",
        payload: tickets,
      });
    } catch (error) {
      CustomError.createError({
        name: "Error-tickets",
        cause: error,
        message: "An error occurred while fetching tickets",
        code: EErros.DATABASES_READ_ERROR,
      });

      req.logger.error({
        message: "An error occurred while fetching tickets",
        cause: error,
        Date: new Date().toLocaleTimeString(),
        stack: JSON.stringify(error.stack, null, 2),
      });
    }
  }

  async getTicketById(req, res) {
    try {
      const ticketId = req.params.pid;
      const ticket = await ticketService.getTicketById(ticketId);

      if (!ticket) {
        CustomError.createError({
          name: "Error-ticket-by-id",
          cause: "Ticket was not found",
          message: "Ticket was not found",
          code: EErros.DATABASES_READ_ERROR,
        });

        req.logger.error({
          message: "Ticket was not found",
          Date: new Date().toLocaleTimeString(),
        });
      }

      return res.send({
        status: "Success",
        message: "Ticket found",
        payload: ticket,
      });
    } catch (error) {
      CustomError.createError({
        name: "Error-ticket-by-id",
        cause: error,
        message: "An error occurred while fetching ticket by ID",
        code: EErros.DATABASES_READ_ERROR,
      });

      req.logger.error({
        message: "An error occurred while fetching ticket by ID",
        cause: error,
        Date: new Date().toLocaleTimeString(),
        stack: JSON.stringify(error.stack, null, 2),
      });
    }
  }

  async getTicketsByStatus(req, res) {
    try {
      const ticketsStatus = req.params.status;
      const tickets = await ticketService.getTicketsByStatus(ticketsStatus);

      if (!tickets) {
        CustomError.createError({
          name: "Error-tickets-by-status",
          cause: "Tickets was not found",
          message: "Tickets was not found",
          code: EErros.DATABASES_READ_ERROR,
        });
        req.logger.debug({
          message: "Ticket was not found",
          Date: new Date().toLocaleTimeString(),
        });
      }

      return res.send({
        status: "success",
        message: "ticket found",
        payload: tickets,
      });
    } catch (error) {
      CustomError.createError({
        name: "Error-ticket-by-status",
        cause: error,
        message: "An error occurred while fetching ticket by status",
        code: EErros.DATABASES_READ_ERROR,
      });

      req.logger.error({
        message: "An error occurred while fetching ticket by status",
        cause: error,
        Date: new Date().toLocaleTimeString(),
        stack: JSON.stringify(error.stack, null, 2),
      });
    }
  }

  async addTicket(req, res) {
  try {
    const ticket = req.body;

    // 1) Código único
    let ticketCode = uuidv4().toString();
    while (await ticketsModel.findOne({ code: ticketCode }).lean()) {
      ticketCode = uuidv4().toString();
    }

    // 2) Validación de stock
    const updatedCart = [];
    for (const cartItem of ticket.cart) {
      const product = await productService.getProductById(cartItem._id);

      if (product && product.stock >= cartItem.cantidad) {
        updatedCart.push(cartItem);
      } else {
        return res.status(400).send({
          status: "error",
          error: "Error-add-product-to-the-cart",
          cause: `Product with ID ${cartItem._id} is out of stock or not found.`,
        });
      }
    }

    // 3) DTO
    const ticketDTO = new TicketDTO(ticketCode, ticket, updatedCart);

    // 4) Generar PDF (Buffer)
    const pdfBuffer = await generarPDF(ticketDTO);

    // 5) Enviar correo con Resend (SI O SI)
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f6f6f6; }
            .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
            .header { text-align: center; padding-bottom: 20px; }
            .header img { max-width: 30%; height: auto; }
            .stage { text-align: center; padding-bottom: 20px; }
            .stage img { max-width: 65%; height: auto; }
            .content { padding: 20px 0; }
            .content p { margin: 10px 0; }
            .highlight { color: #e74c3c; font-weight: bold; font-size: 18px; text-align: center; }
            .footer { text-align: center; font-size: 18px; color: #777777; padding-top: 20px; }
            .social-icons a { margin: 10px; color: #000; text-decoration: none; }
            .iconos { width: 30px; height: 30px; }
            .contact { margin-top: 20px; }
            .saludo { font-size: 18px; }
            .medio { font-size: 15px; text-align: justify; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Fcplogo%20rojo%20registrado%20R%20m%C3%A1s%20grande%20(1).png?alt=media&token=68739185-9438-4bf9-ac31-9b43b3fa9c87" alt="Ciclopista Logo">
            </div>

            <div class="content">
              <p class="saludo"><strong>¡Hola, ${ticketDTO.name}!</strong></p>
              <p class="medio">Ya recibimos la información de tu orden. Estamos a la espera de la aprobación del pago, te avisaremos tan pronto la recibamos.</p>
              <p class="medio">Si seleccionaste método contra entrega debes esperar que un asesor se comunique contigo.</p>
              <br />
              <p class="highlight">Recuerda que tu pedido llegará de 1 a 9 días hábiles después de realizada la compra.</p>
            </div>

            <div class="stage">
              <img src="https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Fpedidorecibido.png?alt=media&token=3f74ad3e-ef30-4e94-a071-c7137355bbce" alt="Pedido recibido logo">
            </div>

            <div class="footer">
              <p><strong>SÍGUENOS EN REDES</strong></p>
              <div class="social-icons">
                <a href="https://instagram.com/ciclopista?igshid=MzRlODBiNWFlZA==" target="_blank">
                  <img src="https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Finstagram%20(1).png?alt=media&token=4126c5ee-7bfd-4b02-be1c-e4ef3b86eee8" class="iconos" alt="Instagram logo">
                </a>
                <a href="https://www.facebook.com/Ciclopista.repuestosyaccesorios?mibextid=ZbWKwL" target="_blank">
                  <img src="https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Ffacebook.png?alt=media&token=280b1d07-9e9d-4008-b5d2-f34d4063ac0e" class="iconos" alt="Facebook logo">
                </a>
                <a href="https://www.tiktok.com" target="_blank">
                  <img src="https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Ftik-tok.png?alt=media&token=2bc42a56-917f-437d-a445-7873d524e06c" class="iconos" alt="Tik Tok logo">
                </a>
              </div>

              <div class="contact">
                <a href="https://wa.link/zxwck6" style="color: inherit; text-decoration: none;">
                  <img src="https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Fwhatsapp.png?alt=media&token=c695aedc-da92-4572-a285-d662330e6493" class="iconos" alt="WhatsApp logo">
                </a>
                <p>+57 350 604 0725</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    await sendEmailWithPdfResend({
      to: `${ticketDTO.purchaser},${entorno.GOOGLE_MAIL_SELLER}`,
      subject: "¡Recibimos tu pedido!",
      html,
      pdfBuffer,
      filename: `${ticketDTO.code}.pdf`,
    });

    // 6) SOLO si el correo se envió, guardas ticket
    await ticketService.addTicket(ticketDTO);

    return res.send({
      status: "OK",
      message: "Ticket successfully added (email sent)",
      payload: ticketCode,
      amount: ticketDTO.amount,
    });
  } catch (err) {
    console.error("addTicket failed:", err);

    // Como tu regla es “si o si correo”, aquí devolvemos error
    return res.status(503).send({
      status: "error",
      error: "EMAIL_FAILED",
      cause: err?.message || "No se pudo enviar el correo",
    });
  }
}


  async updateTicket(req, res) {
    try {
      const ticketCode = req.params.code;
      const changes = req.body;

      const updatedTicket = await ticketService.updateTicket(ticketCode, changes);

      if (!updatedTicket) {
        CustomError.createError({
          name: "Error-update-ticket",
          cause: "Ticket was not found",
          message: "Ticket was not found",
          code: EErros.DATABASES_READ_ERROR,
        });
        req.logger.debug({
          message: "Ticket was not found",
          Date: new Date().toLocaleTimeString(),
        });
      }

      return res.send({
        status: "OK",
        message: "Ticket successfully updated",
      });
    } catch (error) {
      CustomError.createError({
        name: "Error-update-ticket",
        cause: error,
        message: "An error occurred while updating ticket",
        code: EErros.DATABASES_READ_ERROR,
      });
      req.logger.error({
        message: "An error occurred while updating ticket",
        cause: error,
        Date: new Date().toLocaleTimeString(),
        stack: JSON.stringify(error.stack, null, 2),
      });
    }
  }

  async deleteTicket(req, res) {
    try {
      const ticketId = req.params.pid;
      const deletedTicket = await ticketService.deleteTicket(ticketId);

      if (!deletedTicket) {
        req.logger.error({
          message: "Ticket does not exists",
          Date: new Date().toLocaleTimeString(),
        });

        CustomError.createError({
          name: "Error-delete-ticket",
          cause: "Ticket does not exists",
          message: "Ticket does not exists",
          code: EErros.DATABASES_READ_ERROR,
        });
      }

      return res.send({ status: "OK", message: "Ticket deleted successfully" });
    } catch (error) {
      CustomError.createError({
        name: "Error-delete-ticket",
        cause: error,
        message: "An error occurred while deleting ticket",
        code: EErros.DATABASES_READ_ERROR,
      });
      req.logger.error({
        message: "An error occurred while deleting ticket",
        cause: error,
        Date: new Date().toLocaleTimeString(),
        stack: JSON.stringify(error.stack, null, 2),
      });
    }
  }

  async getTicketsByUser(req, res) {
    try {
      const userEmail = req.params.email;
      const userWithOrders = await ticketService.getTicketsByUser(userEmail);

      if (!userEmail) {
        req.logger.debug({
          message: "User does not exists",
          Date: new Date().toLocaleTimeString(),
        });

        CustomError.createError({
          name: "Error-user",
          cause: "User does not exists",
          message: "User does not exists",
          code: EErros.DATABASES_READ_ERROR,
        });
      }

      return res.send({
        status: "success",
        message: "user found",
        payload: userWithOrders,
      });
    } catch (error) {
      CustomError.createError({
        name: "Error-tickects-by-user",
        cause: error,
        message: "An error occurred while fetching ticket by Email",
        code: EErros.DATABASES_READ_ERROR,
      });

      req.logger.error({
        message: "An error occurred while fetching ticket by Email",
        cause: error,
        Date: new Date().toLocaleTimeString(),
        stack: JSON.stringify(error.stack, null, 2),
      });
    }
  }

  async getTicketByCode(code) {
    return await ticketsModel.findOne({ code }).lean();
  }


  async webhookMercadoPago(req, res) {
    const paymentId = req.query.id;

    try {
      // 1) Consultar pago en Mercado Pago
      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${client.accessToken}` },
        }
      );

      if (!response.ok) return res.sendStatus(200);

      const data = await response.json();

      // 2) Datos principales
      const statusRaw = (data?.status || "pending").toString().toLowerCase();
      const statusPayUpper = statusRaw.toUpperCase();
      const statusDetail = (data?.status_detail || "").toString();

      const serialOrden = (data?.description || "").toString().trim();
      const mpReference = data?.id ? String(data.id) : String(paymentId || "");

      const amount =
        typeof data?.transaction_amount === "number"
          ? data.transaction_amount
          : null;
      const currency = data?.currency_id || "COP";

      const paymentType =
        data?.payment_type_id || data?.payment_method?.type || "N/A";
      const paymentMethodId =
        data?.payment_method_id || data?.payment_method?.id || "N/A";

      const payerEmail = data?.payer?.email;
      if (!payerEmail) return res.sendStatus(200);

      // 4) Traer ticket completo (PRIMERO)
      const ticket = serialOrden
        ? await ticketsModel.findOne({ code: serialOrden }).lean()
        : null;

      // 🔐 Candado anti doble webhook (DESPUÉS de tener ticket)
      const isFirstApproval =
        statusRaw === "approved" && ticket && ticket.statusPay !== "APPROVED";

      // ✅ Descontar stock SOLO la primera vez
      if (isFirstApproval) {
        for (const item of ticket.cart) {
          await productService.discountStock(item._id, item.quantity);
        }
      }

      // 3) Actualizar estado de pago en Mongo (AL FINAL)
      if (serialOrden) {
        await ticketsModel.updateOne(
          { code: serialOrden },
          { $set: { statusPay: statusPayUpper } }
        );
      }

      // Helpers
      const formatMoney = (value, cur) => {
        if (typeof value !== "number") return "N/A";
        try {
          return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: cur,
            maximumFractionDigits: 0,
          }).format(value);
        } catch {
          return `${value} ${cur}`;
        }
      };

      const paymentTypeHuman =
        paymentType === "credit_card"
          ? "crédito"
          : paymentType === "debit_card"
            ? "débito"
            : paymentType === "bank_transfer"
              ? "transferencia"
              : paymentType;

      const medioPagoTexto = `${String(paymentMethodId).toUpperCase()} (${paymentTypeHuman})`;

      const statusUI = (() => {
        if (statusRaw === "approved")
          return {
            label: "APROBADO",
            bg: "#e8fff1",
            fg: "#1e7a3a",
            border: "#b7efc5",
          };
        if (statusRaw === "pending" || statusRaw === "in_process")
          return {
            label: "PENDIENTE",
            bg: "#fff8e6",
            fg: "#8a5b00",
            border: "#ffe1a6",
          };
        if (statusRaw === "rejected" || statusRaw === "cancelled")
          return {
            label: "RECHAZADO",
            bg: "#ffecec",
            fg: "#a81818",
            border: "#ffb3b3",
          };
        return {
          label: statusRaw.toUpperCase(),
          bg: "#eef2ff",
          fg: "#2b3a8f",
          border: "#c7d2fe",
        };
      })();

      const mensajeEstado = (() => {
        if (statusRaw === "approved") {
          return `
          <p class="medio centerText">
            ¡Gracias por tu compra y por confiar en nosotros! 🚴‍♂️💚
          </p>
          <p class="medio centerText">
            Tu pago fue aprobado y tu pedido ya está en proceso.
          </p>
          <p class="medio centerText">
            Si necesitas ayuda, abajo está el botón de WhatsApp.
          </p>
        `;
        }

        if (statusRaw === "pending" || statusRaw === "in_process") {
          return `
          <p class="medio centerText">
            Tu pago se encuentra en revisión ⏳.
          </p>
          <p class="medio centerText">
            Si tienes dudas, abajo está el botón de WhatsApp.
          </p>
        `;
        }

        if (statusRaw === "rejected" || statusRaw === "cancelled") {
          return `
          <p class="medio centerText">
            Tu pago no pudo ser procesado ❌.
          </p>
          <p class="medio centerText">
            Por favor revisa tu medio de pago o intenta nuevamente.
          </p>
          <p class="medio centerText">
            Si el problema persiste, abajo está el botón de WhatsApp y con gusto te ayudaremos.
          </p>
        `;
        }

        return `
        <p class="medio centerText">
          Estamos procesando la información de tu pago. Si necesitas ayuda, abajo está el botón de WhatsApp.
        </p>
      `;
      })();

      // ✅ 5) Generar PDF comprobante EN MEMORIA (Buffer) - NO guarda nada
      const pdfBuffer = await generarComprobantePagoPDF(
        {
          serialOrden,
          referenciaMp: mpReference,
          estado: statusRaw,
          detalleEstado: statusDetail,
          medioPago: medioPagoTexto,
          monto: amount,
          moneda: currency,
          fecha: data?.date_approved || data?.date_created,
          email: payerEmail,
        },
        ticket
      );

      // 6) HTML del correo
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f6f6f6;
    }
    .wrapper {
      width: 100%;
      padding: 18px 12px;
      background-color: #f6f6f6;
    }
    .container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header { text-align: center; padding-bottom: 16px; }
    .header img { max-width: 160px; width: 40%; height: auto; }

    .content { padding: 6px 0 10px 0; }
    .saludo {
      font-size: 18px;
      text-align: center;
      margin: 0 0 10px 0;
    }
    .medio {
      font-size: 15px;
      line-height: 1.4;
      margin: 10px 0;
    }
    .centerText { text-align: center; }

    .highlight {
      color: #e74c3c;
      font-weight: bold;
      font-size: 16px;
      text-align: center;
      margin-top: 14px;
    }

    .card {
      margin-top: 14px;
      border: 1px solid #e9e9e9;
      border-radius: 14px;
      padding: 14px;
      background: #fafafa;
    }

    .badgeWrap { text-align:center; margin-bottom: 12px; }
    .badge {
      display:inline-block;
      padding: 8px 12px;
      border-radius: 999px;
      font-weight: bold;
      font-size: 13px;
      border: 1px solid ${statusUI.border};
      background: ${statusUI.bg};
      color: ${statusUI.fg};
      letter-spacing: .4px;
    }
    .small { font-size: 12px; color: #666; margin-top: 6px; }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      align-items: stretch;
    }

    .kpi {
      background: #ffffff;
      border: 1px solid #eeeeee;
      border-radius: 12px;
      padding: 12px 14px;
    }
    .kpi .label { font-size: 12px; color: #777; margin-bottom: 6px; }
    .kpi .value {
      font-size: 15px;
      font-weight: bold;
      color: #111;
      word-break: break-word;
      overflow-wrap: anywhere;
      line-height: 1.2;
    }

    .footer {
      text-align: center;
      font-size: 16px;
      color: #777;
      padding-top: 12px;
    }

    .social-icons a {
      margin: 10px;
      text-decoration: none;
      display: inline-block;
    }
    .iconos { width: 30px; height: 30px; }

    .contact { margin-top: 14px; }

    @media (max-width: 520px) {
      .container { padding: 12px; }
      .saludo { font-size: 16px; }
      .medio { font-size: 13px; }
      .highlight { font-size: 14px; }
      .grid { grid-template-columns: 1fr; }
      .kpi .value { font-size: 14px; }
    }
  </style>
</head>

<body>
  <div class="wrapper">
    <div class="container">

      <div class="header">
        <img src="https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Fcplogo%20rojo%20registrado%20R%20m%C3%A1s%20grande%20(1).png?alt=media&token=68739185-9438-4bf9-ac31-9b43b3fa9c87" alt="Ciclopista Logo">
      </div>

      <div class="content">
        <p class="saludo"><strong>¡Hola, ya recibimos tu estado de pago!</strong></p>

        ${mensajeEstado}

        <div class="card">
          <div class="badgeWrap">
            <span class="badge">${statusUI.label}</span>
            ${statusDetail
          ? `<div class="small">Detalle: <strong>${statusDetail}</strong></div>`
          : ``
        }
          </div>

          <div class="grid">
            <div class="kpi">
              <div class="label">Orden</div>
              <div class="value">${serialOrden || "N/A"}</div>
            </div>

            <div class="kpi">
              <div class="label">Referencia MP</div>
              <div class="value">${mpReference}</div>
            </div>

            <div class="kpi">
              <div class="label">Monto</div>
              <div class="value">${formatMoney(amount, currency)}</div>
            </div>

            <div class="kpi">
              <div class="label">Medio de pago</div>
              <div class="value">${medioPagoTexto}</div>
            </div>
          </div>
        </div>

        <p class="highlight">
          Recuerda que tu pedido llegará de 1 a 9 días hábiles después de realizada la compra.
        </p>
      </div>

      <div class="footer">
        <p><strong>SÍGUENOS EN REDES</strong></p>
        <div class="social-icons">
          <a href="https://instagram.com/ciclopista?igshid=MzRlODBiNWFlZA==" target="_blank">
            <img src="https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Finstagram%20(1).png?alt=media&token=4126c5ee-7bfd-4b02-be1c-e4ef3b86eee8" class="iconos" alt="Instagram logo">
          </a>
          <a href="https://www.facebook.com/Ciclopista.repuestosyaccesorios?mibextid=ZbWKwL" target="_blank">
            <img src="https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Ffacebook.png?alt=media&token=280b1d07-9e9d-4008-b5d2-f34d4063ac0e" class="iconos" alt="Facebook logo">
          </a>
          <a href="https://www.tiktok.com" target="_blank">
            <img src="https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Ftik-tok.png?alt=media&token=2bc42a56-917f-437d-a445-7873d524e06c" class="iconos" alt="Tik Tok logo">
          </a>
        </div>

        <div class="contact">
          <a href="https://wa.link/zxwck6" style="color: inherit; text-decoration: none;">
            <img src="https://firebasestorage.googleapis.com/v0/b/ciclopista.appspot.com/o/decorative%2Fwhatsapp.png?alt=media&token=c695aedc-da92-4572-a285-d662330e6493" class="iconos" alt="WhatsApp logo">
          </a>
          <p>+57 350 604 0725</p>
        </div>
      </div>

    </div>
  </div>
</body>
</html>
`;

      // ✅ 7) Enviar correo + adjuntar PDF DESDE MEMORIA (sin path)
      await transport.sendMail({
        from: entorno.GOOGLE_MAIL,
        to: `${payerEmail},${entorno.GOOGLE_MAIL}`,
        subject: `Estado de pago - Orden ${serialOrden || "N/A"}`,
        html,
        attachments: [
          {
            filename: `comprobante-pago-orden-${serialOrden || "N-A"}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });

      return res.sendStatus(200);
    } catch (error) {
      req.logger?.error({
        message: "Webhook MercadoPago error",
        cause: error,
        Date: new Date().toLocaleTimeString(),
        stack: JSON.stringify(error?.stack || error, null, 2),
      });

      return res.sendStatus(200);
    }
  }





}

export const ticketController = new TicketController();
