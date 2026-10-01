// Student Portal Login Logic

function togglePasswordVisibility() {
    const passwordInput = document.getElementById("password");
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
    } else {
        passwordInput.type = "password";
    }
}

function storeStudentSession(user, profile = {}) {
    localStorage.setItem("loginUser", user.uid);
    localStorage.setItem("userName", profile.name || user.displayName || user.email.split("@")[0]);
    localStorage.setItem("userEmail", profile.email || user.email);
    localStorage.setItem("userCourse", profile.course || "General");
    localStorage.setItem("userImage", profile.image || user.photoURL || "");
}

async function handleStudentLogin(event) {
    if (event) event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const loginBtn = document.getElementById("loginBtn");

    if (!email || !password) {
        showToast("Please enter your email and password", "error");
        return;
    }

    try {
        loginBtn.disabled = true;
        loginBtn.innerHTML = `<span>Signing in...</span>`;

        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        const uid = user.uid;

        // Fetch user data from Realtime DB
        const userSnap = await db.ref("user").child(uid).get();
        if (userSnap.exists()) {
            const userData = userSnap.val();
            storeStudentSession(user, userData);
        } else {
            storeStudentSession(user);
        }

        showToast("Sign in successful! Loading your dashboard...", "success");

        setTimeout(() => {
            window.location.replace("dashboard.html");
        }, 1200);

    } catch (error) {
        console.error("Student login failed:", error);
        let msg = "Invalid email or password.";
        if (error.code === "auth/user-not-found") msg = "No student account found with this email.";
        if (error.code === "auth/wrong-password") msg = "Incorrect password. Please try again.";
        showToast(msg, "error");

        loginBtn.disabled = false;
        loginBtn.innerHTML = `<span>Sign In</span>`;
    }
}

async function handleStudentGoogleSignIn() {
    const button = document.getElementById("googleLoginBtn");
    button.disabled = true;
    try {
        const credential = await signInWithGooglePopup();
        const user = credential.user;
        const profileSnapshot = await db.ref("user").child(user.uid).get();
        if (!profileSnapshot.exists()) {
            window.location.replace("signup.html?provider=google");
            return;
        }

        storeStudentSession(user, profileSnapshot.val());
        window.location.replace("dashboard.html");
    } catch (error) {
        console.error("Google sign-in failed:", error);
        if (error.code !== "auth/popup-closed-by-user") {
            showToast(error.message || "Google sign-in could not be completed.", "error");
        }
        button.disabled = false;
    }
}