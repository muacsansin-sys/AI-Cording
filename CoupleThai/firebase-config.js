const defaultFirebaseConfig = {
  apiKey: "AIzaSyCZqZoKTfuI30gcH03Envl8LDE4zqKNIjY",
  authDomain: "lovethai-2ddbc.firebaseapp.com",
  projectId: "lovethai-2ddbc",
  storageBucket: "lovethai-2ddbc.firebasestorage.app",
  messagingSenderId: "18303090977",
  appId: "1:18303090977:web:258f0bb3925d99ff5cfe60"
};

function loadStoredFirebaseConfig() {
  try {
    return JSON.parse(localStorage.getItem('lovebridge-firebase-config') || 'null') || defaultFirebaseConfig;
  } catch (error) {
    return defaultFirebaseConfig;
  }
}

window.firebaseConfig = loadStoredFirebaseConfig();
