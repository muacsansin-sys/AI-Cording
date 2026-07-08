const defaultFirebaseConfig = {
  apiKey: "",
  authDomain: "lovethai-2ddbc.firebaseapp.com",
  projectId: "lovethai-2ddbc",
  storageBucket: "lovethai-2ddbc.firebasestorage.app",
  messagingSenderId: "",
  appId: ""
};

function loadStoredFirebaseConfig() {
  try {
    return JSON.parse(localStorage.getItem('lovebridge-firebase-config') || 'null') || defaultFirebaseConfig;
  } catch (error) {
    return defaultFirebaseConfig;
  }
}

window.firebaseConfig = loadStoredFirebaseConfig();
