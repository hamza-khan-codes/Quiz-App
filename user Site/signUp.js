// Student Portal Registration Logic

let selectedImageFile = null;
let pendingGoogleUser = null;

document.addEventListener("DOMContentLoaded", async () => {
    await loadCoursesForRegistration();
    await restoreGoogleRegistration();
});

function storeGoogleStudentSession(user, profile = {}) {
    localStorage.setItem("loginUser", user.uid);
    localStorage.setItem("userName", profile.name || user.displayName || user.email.split("@")[0]);
    localStorage.setItem("userEmail", profile.email || user.email);
    localStorage.setItem("userCourse", profile.course || "General");
    localStorage.setItem("userImage", profile.image || user.photoURL || "");
}

async function restoreGoogleRegistration() {
    const user = await new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(currentUser => {
            unsubscribe();
            resolve(currentUser);
        });
    });
    if (!user?.providerData.some(provider => provider.providerId === "google.com")) return;

    try {
        const profileSnapshot = await db.ref("user").child(user.uid).get();
        if (profileSnapshot.exists()) {
            storeGoogleStudentSession(user, profileSnapshot.val());
            window.location.replace("dashboard.html");
            return;
        }
        prepareGoogleRegistration(user);
    } catch (error) {
        console.error("Could not restore Google registration:", error);
        showToast("Could not load your profile. Check your connection and try again.", "error");
    }
}

function prepareGoogleRegistration(user) {
    pendingGoogleUser = user;
    document.getElementById("name").value = user.displayName || "";
    document.getElementById("email").value = user.email || "";
    document.getElementById("passwordGroup").hidden = true;
    document.getElementById("password").required = false;
    document.getElementById("googleSignupBtn").hidden = true;
    document.getElementById("signupBtn").innerHTML = "Complete Google registration";
    if (user.photoURL) document.getElementById("avatarPreview").src = user.photoURL;
}

async function handleStudentGoogleSignIn() {
    const button = document.getElementById("googleSignupBtn");
    button.disabled = true;
    try {
        const credential = await signInWithGooglePopup();
        const user = credential.user;
        const profileSnapshot = await db.ref("user").child(user.uid).get();
        if (profileSnapshot.exists()) {
            storeGoogleStudentSession(user, profileSnapshot.val());
            window.location.replace("dashboard.html");
            return;
        }
        prepareGoogleRegistration(user);
    } catch (error) {
        console.error("Google registration failed:", error);
        if (error.code !== "auth/popup-closed-by-user") {
            showToast(error.message || "Google sign-in could not be completed.", "error");
        }
    } finally {
        button.disabled = false;
    }
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById("password");
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
    } else {
        passwordInput.type = "password";
    }
}

async function loadCoursesForRegistration() {
    const select = document.getElementById("courseSelect");
    if (!select) return;

    try {
        const snap = await db.ref("course").get();
        if (snap.exists()) {
            const courses = Object.values(snap.val());
            select.replaceChildren(new Option("Select your enrolled course...", "", true, true));
            courses.forEach(course => select.add(new Option(course.courseName, course.courseName)));
        } else {
            select.innerHTML = `
                <option value="MERN Stack">MERN Stack Development</option>
                <option value="Python AI">Python & AI</option>
                <option value="Graphic Design">Graphic Design</option>
            `;
        }
    } catch (e) {
        console.error("Error loading courses:", e);
        select.innerHTML = `<option value="MERN Stack">MERN Stack</option>`;
    }
}

function previewSelectedImage(event) {
    const file = event.target.files[0];
    if (file) {
        selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById("avatarPreview").src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

async function uploadImageToCloudinary(file) {
    if (!file) return null;

    const cloudName = "dgbkoycyp";
    const uploadPreset = "storageQuizApp";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error("Upload HTTP error: " + response.status);
        }

        const data = await response.json();
        return data.secure_url;
    } catch (e) {
        console.warn("Cloudinary upload failed or offline; using avatar generator fallback:", e);
        return null;
    }
}

async function handleStudentSignup(event) {
    if (event) event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const courseSelect = document.getElementById("courseSelect");
    const course = courseSelect.value;
    const signupBtn = document.getElementById("signupBtn");
    const googleUser = pendingGoogleUser || (auth.currentUser?.providerData.some(provider => provider.providerId === "google.com") ? auth.currentUser : null);

    if (!name || !email || (!googleUser && !password) || !course) {
        showToast("Please fill in all required fields", "error");
        return;
    }

    try {
        signupBtn.disabled = true;
        signupBtn.innerHTML = `<span>Creating Student Account...</span>`;

        // Attempt Cloudinary upload if an image was selected
        let imageUrl = null;
        if (selectedImageFile) {
            imageUrl = await uploadImageToCloudinary(selectedImageFile);
        }

        // Fallback avatar
        if (!imageUrl) {
            imageUrl = googleUser?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
        }

        let uid;
        if (googleUser) {
            if (googleUser.email?.toLowerCase() !== email.toLowerCase()) {
                throw new Error("Use the email address associated with your Google account.");
            }
            uid = googleUser.uid;
        } else {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            uid = result.user.uid;
        }

        // Save profile in Firebase Realtime DB
        const userProfile = {
            uid: uid,
            name: name,
            email: email,
            course: course,
            image: imageUrl,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        await db.ref("user").child(uid).set(userProfile);

        // Store session in localStorage
        localStorage.setItem("loginUser", uid);
        localStorage.setItem("userName", name);
        localStorage.setItem("userEmail", email);
        localStorage.setItem("userCourse", course);
        localStorage.setItem("userImage", imageUrl);
        pendingGoogleUser = null;

        showToast("Registration successful! Welcome to the portal.", "success");

        setTimeout(() => {
            window.location.replace("dashboard.html");
        }, 1500);

    } catch (error) {
        console.error("Signup error:", error);
        let msg = error.message;
        if (error.code === "auth/email-already-in-use") {
            msg = "This email address is already registered. Please log in.";
        } else if (error.code === "auth/weak-password") {
            msg = "Password should be at least 6 characters long.";
        }
        showToast(msg, "error");

        signupBtn.disabled = false;
        signupBtn.innerHTML = pendingGoogleUser ? "Complete Google registration" : `<span>Complete Registration</span>`;
    }
}