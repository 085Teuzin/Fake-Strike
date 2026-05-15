import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, onDisconnect, update, get } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyBqRAsWfP4w-r82PZOaJcDck7W8Aeph3p8",
    authDomain: "teuzin-games.firebaseapp.com",
    databaseURL: "https://teuzin-games-default-rtdb.firebaseio.com",
    projectId: "teuzin-games",
    storageBucket: "teuzin-games.firebasestorage.app",
    messagingSenderId: "548192563345",
    appId: "1:548192563345:web:e729e39f9f266aa6a68f30"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, set, onValue, onDisconnect, update, get };