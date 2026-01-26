import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where, enableIndexedDbPersistence, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig, hashPass } from './config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

enableIndexedDbPersistence(db).catch((err) => { console.log(err.code); });

let currentCustomer = null;
let currentTransType = '';
let allCustomers = [];
let editingCustId = null;

function initAnimations() {
    if(typeof gsap !== 'undefined') {
        gsap.utils.toArray('.gsap-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => gsap.to(btn, { scale: 1.05, duration: 0.2 }));
            btn.addEventListener('mouseleave', () => gsap.to(btn, { scale: 1, duration: 0.2 }));
        });
    }
}

// === إضافة مستمع لتنسيق المبلغ تلقائياً بالفواصل (نقاط) أثناء الكتابة ===
document.addEventListener('DOMContentLoaded', () => {
    const amountInput = document.getElementById('transAmount');
    if(amountInput) {
        amountInput.addEventListener('input', function(e) {
            // إزالة أي شيء ليس رقماً
            let rawValue = this.value.replace(/[^0-9]/g, '');
            if (!rawValue) return;
            // إضافة النقطة كفاصل للألوف (تنسيق ألماني يستخدم النقطة)
            this.value = Number(rawValue).toLocaleString('de-DE');
        });
    }
});

window.checkAdminLogin = function() {
    const passInput = document.getElementById('adminPassInput').value;
    const storeInput = document.getElementById('storeNameInput').value;
    const storedPass = localStorage.getItem('admin_pass');
    
    if(storeInput) localStorage.setItem('store_name', storeInput);

    if (!storedPass) {
        if (passInput === '1234') {
            localStorage.setItem('admin_pass', hashPass('1234'));
            unlockApp();
        } else {
            alert("كلمة المرور الافتراضية لأول مرة هي: 1234");
        }
    } else {
        if (hashPass(passInput) === storedPass) unlockApp();
        else alert("كلمة المرور خاطئة");
    }
}

function unlockApp() {
    document.getElementById('lock-screen').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    const storeName = localStorage.getItem('store_name');
    if(storeName) document.getElementById('headerStoreName').innerText = storeName;
    loadDashboard();
    loadSettings();
    initAnimations();
}

async function loadDashboard() {
    try {
        const custSnapshot = await getDocs(collection(db, "customers"));
        allCustomers = custSnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        
        const transSnapshot = await getDocs(collection(db, "transactions"));
        const transactions = transSnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));

        let totalDebt = 0;
        let totalPaidAll = 0; // متغير لحساب إجمالي الواصل (التسديدات)
        const now = new Date();
        const overdueList = [];

        // حساب الديون لكل زبون
        allCustomers.forEach(c => {
            c.balance = 0;
            const myTrans = transactions.filter(t => t.customerId === c.id);
            
            myTrans.forEach(t => {
                const amt = parseFloat(t.amount) || 0;
                if (t.type === 'debt' || t.type === 'sale') c.balance += amt;
                if (t.type === 'payment') c.balance -= amt;
            });
            
            if(myTrans.length > 0 && c.balance > 0) {
                myTrans.sort((a,b) => new Date(b.date) - new Date(a.date));
                c.lastDate = myTrans[0].date;
                const lastTransDate = new Date(c.lastDate);
                if(!isNaN(lastTransDate)) {
                    const diffTime = Math.abs(now - lastTransDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    const reminderDays = parseInt(c.reminderDays || 30);
                    if (diffDays >= reminderDays) {
                        c.isOverdue = true;
                        overdueList.push(c);
                    } else { c.isOverdue = false; }
                }
            } else { c.isOverdue = false; }
        });

        // حساب إجمالي الديون المتبقية
        totalDebt = allCustomers.reduce((sum, c) => sum + c.balance, 0);

        // التعديل: حساب إجمالي كل المبالغ "الواصلة" (نوع payment) لجميع الزبائن
        transactions.forEach(t => {
            if (t.type === 'payment') {
                totalPaidAll += (parseFloat(t.amount) || 0);
            }
        });

        // عرض القيم في الواجهة
        document.getElementById('totalDebt').innerText = formatCurrency(totalDebt, 'IQD');
        // عرض إجمالي الواصل الجديد
        document.getElementById('totalPaidDisplay').innerText = formatCurrency(totalPaidAll, 'IQD');
        
        document.getElementById('customerCount').innerText = allCustomers.length;
        
        renderCustomersList(allCustomers);
        renderNotifications(overdueList);
    } catch (error) {
        console.error(error);
        if(navigator.onLine) alert("حدث خطأ في الاتصال: " + error.message);
    }
}

function renderCustomersList(customers) {
    const list = document.getElementById('customersList');
    list.innerHTML = '';
    if(customers.length === 0) {
        list.innerHTML = '<p style="text-align:center">لا يوجد بيانات</p>';
        return;
    }
    customers.forEach(c => {
        const div = document.createElement('div');
        div.className = 'card glass flex flex-between';
        div.style.cursor = 'pointer';
        div.onclick = () => openCustomer(c.id);
        
        let alertIcon = c.isOverdue ? '⚠️' : '';
        let balanceColor = c.balance > 0 ? 'var(--danger)' : 'var(--accent)';

        div.innerHTML = `
            <div><strong>${c.name} ${alertIcon}</strong><br><small>${c.phone || ''}</small></div>
            <div style="text-align:left"><span style="font-weight:bold; color:${balanceColor}">${formatCurrency(c.balance, c.currency)}</span><br><small style="font-size:0.7em; color:#666">${c.lastDate || 'جديد'}</small></div>
        `;
        list.appendChild(div);
    });
}

function renderNotifications(list) {
    const container = document.getElementById('alertsList');
    const badge = document.getElementById('badge-alert');
    if(!container || !badge) return;
    container.innerHTML = '';
    
    if(list.length > 0) {
        badge.classList.remove('hidden');
        badge.innerText = list.length;
        list.forEach(c => {
            const div = document.createElement('div');
            div.className = 'card glass';
            div.style.borderRight = '5px solid orange';
            div.innerHTML = `
                <div class="flex flex-between"><strong>⚠️ ${c.name}</strong><span>${formatCurrency(c.balance, c.currency)}</span></div>
                <small>تجاوز ${c.reminderDays || 30} يوم</small><br>
                <button class="btn btn-sm btn-primary mt-2" onclick="openCustomer('${c.id}')">مراجعة</button>
            `;
            container.appendChild(div);
        });
    } else {
        badge.classList.add('hidden');
        container.innerHTML = '<p class="text-center">لا توجد تنبيهات ✅</p>';
    }
}

window.openAddModal = function() {
    editingCustId = null;
    document.getElementById('modalCustTitle').innerText = "زبون جديد";
    document.getElementById('newCustName').value = '';
    document.getElementById('newCustPhone').value = '';
    document.getElementById('newCustPass').value = '';
    window.showModal('modal-add-customer');
}

window.saveCustomer = async function() {
    const name = document.getElementById('newCustName').value;
    const phone = document.getElementById('newCustPhone').value;
    const currency = document.getElementById('newCustCurrency').value;
    const reminderDays = document.getElementById('newCustReminder').value;
    let pass = document.getElementById('newCustPass').value;
    
    if(!name) return alert('الاسم مطلوب');

    if (!pass) {
        do {
            pass = Math.floor(100 + Math.random() * 900).toString();
        } while (allCustomers.some(c => c.password === pass && c.id !== editingCustId));
    } else {
        const exists = allCustomers.some(c => c.password === pass && c.id !== editingCustId);
        if (exists) return alert("هذا الرمز مستخدم بالفعل لزبون آخر! اختر رمزاً آخر.");
    }

    try {
        if (editingCustId) {
            const customerRef = allCustomers.find(c => c.id === editingCustId);
            updateDoc(doc(db, "customers", customerRef.firebaseId), {
                name, phone, currency, reminderDays, password: pass
            });
            alert("تم تعديل بيانات الزبون");
        } else {
            const id = Date.now().toString();
            addDoc(collection(db, "customers"), {
                id, name, phone, currency, 
                reminderDays: reminderDays || 30,
                password: pass,
                created: new Date().toISOString()
            });
        }
        
        window.closeModal('modal-add-customer');
        loadDashboard();
        if(editingCustId) goHome();
    } catch (e) { alert("خطأ: " + e.message); }
}

window.openCustomer = async function(id) {
    const customer = allCustomers.find(c => c.id == id);
    if (!customer) return;
    currentCustomer = customer;
    
    const q = query(collection(db, "transactions"), where("customerId", "==", id));
    const snap = await getDocs(q);
    const trans = snap.docs.map(d => ({firebaseId: d.id, ...d.data()}));
    trans.sort((a,b) => new Date(b.date) - new Date(a.date));

    let realTimeBalance = 0;
    trans.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'debt' || t.type === 'sale') realTimeBalance += amt;
        if (t.type === 'payment') realTimeBalance -= amt;
    });

    document.getElementById('view-customer').classList.remove('hidden');
    document.getElementById('custName').innerText = customer.name;
    document.getElementById('custPhone').innerText = customer.phone || '';
    
    document.getElementById('custBalance').innerText = formatCurrency(realTimeBalance, customer.currency);
    
    document.getElementById('custPasswordDisplay').innerText = customer.password || '---';

    renderTransactions(trans, customer.currency);
}

window.deleteCustomer = async function() {
    if (!currentCustomer) return;
    
    const code = prompt("أدخل رمز التأكيد للحذف:");
    if (code !== "121") return alert("رمز التأكيد خطأ");

    if (!confirm(`هل أنت متأكد من حذف الزبون "${currentCustomer.name}" وجميع ديونه؟ لا يمكن التراجع!`)) return;

    try {
        await deleteDoc(doc(db, "customers", currentCustomer.firebaseId));
        const q = query(collection(db, "transactions"), where("customerId", "==", currentCustomer.id));
        const snap = await getDocs(q);
        snap.forEach(async (d) => {
            await deleteDoc(doc(db, "transactions", d.id));
        });

        alert("تم الحذف بنجاح");
        goHome();
    } catch(e) { alert("خطأ في الحذف: " + e.message); }
}

window.editCustomer = function() {
    if (!currentCustomer) return;

    const code = prompt("أدخل رمز التأكيد للتعديل:");
    if (code !== "121") return alert("رمز التأكيد خطأ");

    editingCustId = currentCustomer.id;
    
    document.getElementById('modalCustTitle').innerText = "تعديل بيانات الزبون";
    document.getElementById('newCustName').value = currentCustomer.name;
    document.getElementById('newCustPhone').value = currentCustomer.phone;
    document.getElementById('newCustCurrency').value = currentCustomer.currency;
    document.getElementById('newCustReminder').value = currentCustomer.reminderDays;
    document.getElementById('newCustPass').value = currentCustomer.password;
    
    window.showModal('modal-add-customer');
}

window.downloadBackup = async function() {
    if(!confirm("تحميل نسخة احتياطية من كل البيانات؟")) return;
    try {
        const custSnap = await getDocs(collection(db, "customers"));
        const transSnap = await getDocs(collection(db, "transactions"));
        const backupData = {
            date: new Date().toISOString(),
            customers: custSnap.docs.map(d => d.data()),
            transactions: transSnap.docs.map(d => d.data())
        };
        const blob = new Blob([JSON.stringify(backupData)], {type: "application/json"});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    } catch(e) { alert("خطأ: " + e.message); }
}

window.restoreBackup = function(input) {
    const file = input.files[0];
    if(!file) return;
    if(!confirm("استعادة النسخة سيضيف البيانات الحالية. متأكد؟")) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if(data.customers) for(const c of data.customers) await addDoc(collection(db, "customers"), c);
            if(data.transactions) for(const t of data.transactions) await addDoc(collection(db, "transactions"), t);
            alert("تمت الاستعادة!");
            location.reload();
        } catch(err) { alert("ملف غير صالح"); }
    };
    reader.readAsText(file);
}

window.saveStoreSettings = async function() {
    const wa = document.getElementById('storeWhatsapp').value;
    if(!wa) return;
    await setDoc(doc(db, "settings", "info"), { whatsapp: wa }, { merge: true });
    alert("تم حفظ الواتساب");
}

async function loadSettings() {
    const s = await getDoc(doc(db, "settings", "info"));
    if(s.exists()) document.getElementById('storeWhatsapp').value = s.data().whatsapp || '';
}

window.changeAdminPassReal = function() {
    const old = document.getElementById('oldPass').value;
    const newP = document.getElementById('newPass').value;
    const confP = document.getElementById('confirmPass').value;
    if(hashPass(old) !== localStorage.getItem('admin_pass')) return alert("الكلمة الحالية خطأ");
    if(newP !== confP) return alert("كلمة المرور غير متطابقة");
    localStorage.setItem('admin_pass', hashPass(newP));
    location.reload();
}

// === التعديل: تغيير التنسيق ليستخدم النقاط (de-DE) بدلاً من الفواصل ===
window.formatCurrency = (n, c) => {
    // de-DE يستخدم النقطة للألوف (10.000) وهو المطلوب
    const formatted = Number(n).toLocaleString('de-DE', {minimumFractionDigits: 0, maximumFractionDigits: 2});
    return c === 'USD' ? `$${formatted}` : `${formatted} د.ع`;
};

window.showModal = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
window.goHome = () => { document.getElementById('view-customer').classList.add('hidden'); loadDashboard(); };
window.switchTab = (id, btn) => {
    document.querySelectorAll('.tab-content').forEach(d => d.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}
window.openTransModal = function(type) {
    currentTransType = type;
    document.getElementById('transTitle').innerText = type === 'debt' ? 'إضافة دين' : (type === 'payment' ? 'تسديد' : 'بيع');
    document.getElementById('transDate').valueAsDate = new Date();
    document.getElementById('transAmount').value = '';
    window.showModal('modal-transaction');
}
window.saveTransaction = async function() {
    // التعديل: تنظيف القيمة من النقاط قبل الحفظ في قاعدة البيانات لتخزينها كرقم صحيح
    let rawAmount = document.getElementById('transAmount').value;
    // حذف النقاط والفواصل لتحويله لرقم خام
    rawAmount = rawAmount.replace(/\./g, '').replace(/,/g, '');
    
    const amount = parseFloat(rawAmount);
    const note = document.getElementById('transNote').value;
    const item = document.getElementById('transItem').value;
    const date = document.getElementById('transDate').value;
    
    if(!amount) return alert("أدخل المبلغ");
    
    addDoc(collection(db, "transactions"), {
        customerId: currentCustomer.id,
        type: currentTransType,
        amount, note, item, date,
        timestamp: new Date().toISOString()
    });
    
    closeModal('modal-transaction');
    openCustomer(currentCustomer.id);
    loadDashboard();
}
function renderTransactions(transactions, currency) {
    const list = document.getElementById('transactionsList');
    list.innerHTML = '';
    transactions.forEach(t => {
        const div = document.createElement('div');
        div.className = 'trans-item flex flex-between';
        let colorClass = (t.type === 'payment') ? 'trans-pay' : 'trans-debt';
        let typeName = t.type === 'debt' ? 'دين' : (t.type === 'payment' ? 'تسديد' : 'فاتورة');
        
        // تطبيق التنسيق الجديد (نقاط) هنا أيضاً
        div.innerHTML = `
            <div><strong class="${colorClass}">${typeName}</strong> <small>${t.item || ''}</small><br><small>${t.date}</small></div>
            <strong class="${colorClass}">${window.formatCurrency(t.amount, currency)}</strong>
        `;
        list.appendChild(div);
    });
}
window.logout = function() { location.reload(); }
if(localStorage.getItem('admin_pass')) { /* Locked */ }
