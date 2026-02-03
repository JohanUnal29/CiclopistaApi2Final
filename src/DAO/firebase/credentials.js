// Importamos la función para inicializar la aplicación de Firebase
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { entorno } from "../../config";

// Añade aquí tus credenciales
const firebaseConfig = {
    apiKey: `${entorno.APIKEY_FIREBASE}`,
    authDomain: "ciclopista.firebaseapp.com",
    projectId: "ciclopista",
    storageBucket: "ciclopista.appspot.com",
    messagingSenderId: `${entorno.SENDER_ID}`,
    appId: `${entorno.APPID}`,
    measurementId: `${entorno.MEASUREMENTID}`
};

// Inicializamos la aplicación y la guardamos en firebaseApp
const firebaseApp = initializeApp(firebaseConfig);
// Exportamos firebaseApp para poder utilizarla en cualquier lugar de la aplicación
// const analytics = getAnalytics(app);
export default firebaseApp;