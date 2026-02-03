import path from 'path';
import { fileURLToPath } from 'url';
export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

import dotenv from 'dotenv';

export const entorno = { MODE: process.argv[2] };

if (process.argv[2] != 'DEV' && process.argv[2] != 'PROD') {
  console.log('por favor inidique prod o dev');
  process.exit();
}

dotenv.config({
  path: process.argv[2] === 'DEV' ? './.env.development' : './.env.production',
});

entorno.PORT = process.env.PORT;
entorno.MONGO_URL = process.env.MONGO_URL;
entorno.ADMIN_NAME = process.env.ADMIN_NAME;
entorno.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

entorno.SecretoSeguridad = process.env.SecretoSeguridad;

entorno.GOOGLE_MAIL = process.env.GOOGLE_MAIL;
entorno.GOOGLE_PASS = process.env.GOOGLE_PASS;
entorno.GOOGLE_MAIL_SELLER = process.env.GOOGLE_MAIL_SELLER;
entorno.FRONT_URL = process.env.FRONT_URL;

entorno.ACCESS_TOKE_MELI = process.env.ACCESS_TOKE_MELI;

entorno.URL_WEBHOOK = process.env.URL_WEBHOOK;

entorno.CLIENT_ID_GOOGLEAUTH = process.env.CLIENT_ID_GOOGLEAUTH;
entorno.CLIENT_SECRET_GOOGLE = process.env.CLIENT_SECRET_GOOGLE;
entorno.CALL_BACK_URL_GOOGLE = process.env.CALL_BACK_URL_GOOGLE;


/* export default {
  port: process.env.PORT,
  mongoUrl: process.env.MONGO_URL,
  adminName: process.env.ADMIN_NAME,
  adminPassword: process.env.ADMIN_PASSWORD,
}; */