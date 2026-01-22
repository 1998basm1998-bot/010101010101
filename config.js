// === إعدادات Firebase ===
export const firebaseConfig = {
    apiKey: "AIzaSyCGVuftvCWX8psK9-GnMIFUbK8hYIpl36s",
    authDomain: "sedkrar-1c800.firebaseapp.com",
    projectId: "sedkrar-1c800",
    storageBucket: "sedkrar-1c800.firebasestorage.app",
    messagingSenderId: "984266925049",
    appId: "1:984266925049:web:bfe5fd2a4e4cfd2c9c5328"
};

// ⚠️ هام جداً: ضع هنا رابط موقع الزبائن الذي قمت برفعه
// مثال: https://customer-app.netlify.app
export const CUSTOMER_SITE_URL = "https://example-customer-app.com"; 

export const hashPass = str => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString();
};
