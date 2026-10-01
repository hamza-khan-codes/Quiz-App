// Centralized Firebase Configuration & Utilities for Quiz App
const firebaseConfig = {
    apiKey: "AIzaSyBw8pAT_2oOCQ5jSERPpbaqgV0NcSwEG4c",
    authDomain: "quiz-app-a7554.firebaseapp.com",
    databaseURL: "https://quiz-app-a7554-default-rtdb.firebaseio.com",
    projectId: "quiz-app-a7554",
    storageBucket: "quiz-app-a7554.firebasestorage.app",
    messagingSenderId: "1035498201773",
    appId: "1:1035498201773:web:50032abad26f52a8ff5c24"
};

// Initialize Firebase if not already initialized
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();

function signInWithGooglePopup() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    return auth.signInWithPopup(provider);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// Modern Toast Notification System
function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type}`;

    const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
    const toastIcon = document.createElement("span");
    toastIcon.className = "toast-icon";
    toastIcon.textContent = icon;
    const toastMessage = document.createElement("span");
    toastMessage.className = "toast-message";
    toastMessage.textContent = message;
    toast.append(toastIcon, toastMessage);

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("show");
    }, 10);

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Database Helper: fetch questions supporting both " Questions" (legacy with space) and "Questions"
async function fetchQuizQuestions(quizKey) {
    try {
        let snapshot = await db.ref("Questions").child(quizKey).get();
        if (!snapshot.exists()) {
            snapshot = await db.ref(" Questions").child(quizKey).get();
        }
        if (snapshot.exists()) {
            const raw = snapshot.val();
            return Object.entries(raw).map(([key, q]) => ({
                id: key,
                ...q,
                options: q.options || [q.option1, q.option2, q.option3, q.option4].filter(Boolean),
                correctAnswers: q.correctAnswers || q.correctOptions || q.answer
            }));
        }
        return [];
    } catch (e) {
        console.error("Error fetching questions:", e);
        return [];
    }
}

