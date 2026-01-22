// === إعدادات Firebase ===
export const firebaseConfig = {
    apiKey: "AIzaSyAI9rupxuvcgfWglCyKVwsme9zOU0cNEHs",
    authDomain: "gjjjjjh.firebaseapp.com",
    projectId: "gjjjjjh",
    storageBucket: "gjjjjjh.firebasestorage.app",
    messagingSenderId: "450515501802",
    appId: "1:450515501802:web:f350b63d59665d732d4d93"
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
