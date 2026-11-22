/* 🔥 Firebase config of the NEW project for this app (not the shop app's project).
   Firebase Console → ⚙️ Project settings → General → "Your apps" → Web app (</>) → "SDK setup and configuration" → Config.
   Copy the values in below. This config is not secret; your Firestore Rules protect the data. */
window.HISAB_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBs1LNBo6dike00ziFUdggkEjWkLIHghnY",
  authDomain: "bahi-436c2.firebaseapp.com",
  projectId: "bahi-436c2",
  storageBucket: "bahi-436c2.firebasestorage.app",
  messagingSenderId: "77576875080",
  appId: "1:77576875080:web:627edf58787bbaa655fc7d"
};

/* The two login accounts. Create them in the NEW project:
   Firebase Console → Authentication → Users → Add user (email + password).
   Must match firestore.rules. */
window.HISAB_ROLE_EMAILS = {
  "muhammadiafinance+shop@gmail.com": "admin",     // Shop login  → Daily Hisab only
  "muhammadiafinance+bank@gmail.com": "employee"   // Bank login  → full Bank portal
};
