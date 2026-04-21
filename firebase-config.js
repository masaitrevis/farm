// Firebase Configuration
// Replace with your actual Firebase config from Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyCHHJjVyD2M6I5zVdspw6H-NjHnAOkfWM8",
    authDomain: "farm-8da93.firebaseapp.com",
    projectId: "farm-8da93",
    storageBucket: "farm-8da93.firebasestorage.app",
    messagingSenderId: "819238327058",
    appId: "1:819238327058:web:b3de712b1eb4211ada59cb"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get references to Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Export for use in other modules
window.firebaseAuth = auth;
window.firebaseDb = db;
