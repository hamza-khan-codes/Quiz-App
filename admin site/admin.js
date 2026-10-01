// Admin Portal Authentication Logic

function togglePasswordVisibility() {
    const passwordInput = document.getElementById("password");
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
    } else {
        passwordInput.type = "password";
    }
}

async function createFirstAdmin(email, password) {
    if (!email || !password) {
        throw new Error("Email and password are required to create the first admin.");
    }

    try {
        const adminSnapshot = await db.ref("admins").once("value");
        const admins = adminSnapshot.val() || {};
        const hasAdmin = Object.values(admins).some(entry => entry && entry.role === "admin");

        if (hasAdmin) {
            return { message: "An admin already exists." };
        }

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.ref("admins").child(userCredential.user.uid).set({ role: "admin" });

        return {
            user: userCredential.user,
            message: "First admin account created successfully."
        };
    } catch (error) {
        if (error.code === "auth/email-already-in-use") {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            await db.ref("admins").child(userCredential.user.uid).set({ role: "admin" });
            return {
                user: userCredential.user,
                message: "This account was reused and granted admin access."
            };
        }

        throw error;
    }
}

async function handleAdminLogin(event) {
    if (event) event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const loginBtn = document.getElementById("loginBtn");

    if (!email || !password) {
        showToast("Please enter both email and password.", "error");
        return;
    }

    try {
        loginBtn.disabled = true;
        loginBtn.innerHTML = `<span>Signing in...</span>`;

        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        await completeAdminSignIn(userCredential.user);
    } catch (error) {
        console.error("Login failed:", error);
        let msg = "Invalid email or password.";
        if (error.code === "auth/user-not-found") msg = "Admin account not found.";
        if (error.code === "auth/wrong-password") msg = "Incorrect password.";
        if (error.message.includes("not enabled")) msg = error.message;
        showToast(msg, "error");

        loginBtn.disabled = false;
        loginBtn.textContent = "Sign in to admin";
    }
}

async function handleAdminGoogleSignIn() {
    const button = document.getElementById("googleLoginBtn");
    button.disabled = true;
    try {
        const credential = await signInWithGooglePopup();
        await completeAdminSignIn(credential.user);
    } catch (error) {
        console.error("Google admin sign-in failed:", error);
        if (error.code !== "auth/popup-closed-by-user") {
            showToast(error.message || "Google sign-in could not be completed.", "error");
        }
        button.disabled = false;
    }
}

async function completeAdminSignIn(user) {
    const roleSnapshot = await db.ref("admins").child(user.uid).child("role").get();
    if (roleSnapshot.val() !== "admin") {
        await auth.signOut();
        throw new Error("This account is not enabled for administrator access.");
    }
    showToast("Sign-in successful. Welcome, administrator.", "success");
    window.setTimeout(() => window.location.replace("dashboard.html"), 700);
}