const defaultFirebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
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
