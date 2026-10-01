// Student Dashboard Logic

let currentStudent = null;
let currentUid = null;

document.addEventListener("DOMContentLoaded", async () => {
    const user = auth.currentUser || await new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(currentUser => {
            unsubscribe();
            resolve(currentUser);
        });
    });
    currentUid = user?.uid;
    if (!currentUid) {
        window.location.replace("login.html");
        return;
    }

    await loadStudentProfile();
    await loadAvailableQuizzes();
    await loadStudentResults();
});

function switchTab(tabName) {
    const tabs = ["quizzes", "idcard", "results"];
    tabs.forEach(t => {
        const sec = document.getElementById(`${t}Section`);
        const btn = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}Btn`);
        if (sec) sec.style.display = (t === tabName) ? "block" : "none";
        if (btn) btn.classList.toggle("active", t === tabName);
    });
}

function studentLogout() {
    auth.signOut().then(() => {
        localStorage.clear();
        window.location.replace("login.html");
    });
}

async function loadStudentProfile() {
    try {
        const snap = await db.ref("user").child(currentUid).get();
        if (snap.exists()) {
            currentStudent = snap.val();
        } else {
            currentStudent = {
                name: localStorage.getItem("userName") || "Student",
                email: localStorage.getItem("userEmail") || "student@example.com",
                course: localStorage.getItem("userCourse") || "MERN Stack",
                image: localStorage.getItem("userImage") || ""
            };
        }

        const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentStudent.name || 'Student')}`;
        const avatarSrc = currentStudent.image || defaultAvatar;

        // Navbar info
        document.getElementById("topNavName").innerText = currentStudent.name || "Student";
        document.getElementById("topNavCourse").innerText = currentStudent.course || "Student";
        document.getElementById("topNavAvatar").src = avatarSrc;

        // ID Card info
        document.getElementById("cardStudentName").innerText = currentStudent.name || "Student";
        document.getElementById("cardStudentEmail").innerText = currentStudent.email || "student@example.com";
        document.getElementById("cardStudentCourse").innerText = currentStudent.course || "MERN Stack";
        document.getElementById("cardCourseTag").innerText = (currentStudent.course || "MERN Stack") + " STUDENT";
        document.getElementById("cardStudentUid").innerText = "SMIT-" + currentUid.substring(0, 6).toUpperCase();
        document.getElementById("cardFooterId").innerText = "SMIT-" + currentUid.substring(0, 8).toUpperCase();

        const cardImg = document.getElementById("cardStudentImage");
        cardImg.src = avatarSrc;
        cardImg.onerror = () => { cardImg.src = defaultAvatar; };

        // Generate QR code
        const qrContainer = document.getElementById("qrcode");
        qrContainer.innerHTML = "";
        new QRCode(qrContainer, {
            text: `SMIT-VERIFIED:${currentStudent.email}:${currentUid}`,
            width: 85,
            height: 85,
            colorDark: "#0f172a",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });

    } catch (err) {
        console.error("Error loading student profile:", err);
    }
}

async function loadAvailableQuizzes() {
    const container = document.getElementById("quizzesContainer");
    if (!container) return;

    try {
        const quizSnap = await db.ref("Quiz").get();
        if (!quizSnap.exists()) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 48px 0; color: #94a3b8;">
                    <div style="font-size: 40px; margin-bottom: 8px;">📝</div>
                    <h4>No quizzes currently published</h4>
                    <p>Your instructors have not released any quizzes yet. Please check back later.</p>
                </div>
            `;
            return;
        }

        const quizzes = Object.entries(quizSnap.val()).map(([key, quiz]) => ({ ...quiz, quizKey: quiz.quizKey || key }));

        // Get question counts for each quiz
        const questionCounts = await Promise.all(
            quizzes.map(async (q) => {
                const qs = await fetchQuizQuestions(q.quizKey);
                return qs.length;
            })
        );

        container.innerHTML = quizzes.map((quiz, idx) => {
            const qCount = questionCounts[idx];
            const duration = quiz.timeLimitMinutes || 10;
            const isReady = qCount > 0;

            return `
                <div class="quiz-card">
                    <div>
                        <div class="quiz-card-header">
                            <h3>${escapeHTML(quiz.quizName || "Assessment")}</h3>
                            <span class="badge badge-primary">${escapeHTML(quiz.coursesName || "Course")}</span>
                        </div>
                        <div class="quiz-card-body">
                            <p>Assess your core understanding and test practical knowledge of ${escapeHTML(quiz.quizName || "this assessment")}.</p>
                        </div>
                    </div>

                    <div>
                        <div class="quiz-meta">
                            <div class="quiz-meta-item">
                                <span>❓</span>
                                <span>${qCount} Question${qCount === 1 ? '' : 's'}</span>
                            </div>
                            <div class="quiz-meta-item">
                                <span>⏱️</span>
                                <span>${duration} Minutes</span>
                            </div>
                        </div>

                        ${isReady ? `
                            <a href="index.html?quizKey=${encodeURIComponent(quiz.quizKey)}" class="btn btn-primary btn-block">
                                🚀 Start Quiz
                            </a>
                        ` : `
                            <button class="btn btn-secondary btn-block" disabled style="cursor: not-allowed; opacity: 0.6;">
                                Questions Pending
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join("");

    } catch (e) {
        console.error("Error loading quizzes:", e);
        showToast("Error loading available quizzes", "error");
    }
}

async function loadStudentResults() {
    const tableBody = document.getElementById("studentResultsTableBody");
    if (!tableBody) return;

    try {
        const snap = await db.ref("quizResults").child(currentUid).get();
        if (!snap.exists()) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="padding: 40px; text-align: center; color: #94a3b8;">
                        <div style="font-size: 32px; margin-bottom: 8px;">📊</div>
                        <h4>No quiz attempts recorded yet</h4>
                        <p>Complete a quiz from the "Available Quizzes" tab to see your scores here.</p>
                    </td>
                </tr>
            `;
            return;
        }

        const myResults = Object.values(snap.val() || {});

        if (myResults.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="padding: 40px; text-align: center; color: #94a3b8;">
                        <div style="font-size: 32px; margin-bottom: 8px;">📊</div>
                        <h4>No quiz attempts recorded yet</h4>
                        <p>Complete a quiz from the "Available Quizzes" tab to see your scores here.</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Sort descending by submission time
        myResults.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));

        tableBody.innerHTML = myResults.map((res, index) => {
            const isPassed = res.percentage >= 50;
            const statusBadge = isPassed
                ? `<span class="badge badge-success">Passed</span>`
                : `<span class="badge badge-danger">Needs Review</span>`;
            const dateStr = res.submittedAt ? new Date(res.submittedAt).toLocaleDateString() : "Recent";

            return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 16px 20px; font-size: 14px;">${index + 1}</td>
                    <td style="padding: 16px 20px; font-size: 14px; font-weight: 700; color: #0f172a;">${escapeHTML(res.quizName || "Quiz")}</td>
                    <td style="padding: 16px 20px; font-size: 14px; color: #475569;">${escapeHTML(res.courseName || "General")}</td>
                    <td style="padding: 16px 20px; font-size: 14px; font-weight: 600;">${escapeHTML(res.score)} / ${escapeHTML(res.totalQuestions)}</td>
                    <td style="padding: 16px 20px; font-size: 14px; font-weight: 700;">${escapeHTML(res.percentage)}%</td>
                    <td style="padding: 16px 20px; font-size: 14px;">${statusBadge}</td>
                    <td style="padding: 16px 20px; font-size: 14px; color: #64748b;">${dateStr}</td>
                </tr>
            `;
        }).join("");

    } catch (e) {
        console.error("Error loading results:", e);
    }
}

async function downloadIdCardPdf() {
    const card = document.getElementById("studentIdCard");
    if (!card) return;

    try {
        showToast("Generating high-resolution ID card PDF...", "info");

        const canvas = await html2canvas(card, {
            scale: 3,
            useCORS: true,
            backgroundColor: null
        });

        const imgData = canvas.toDataURL("image/png");
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: [120, 80] // Clean standard ID card aspect ratio
        });

        pdf.addImage(imgData, "PNG", 0, 0, 120, 80);
        const filename = `${(currentStudent?.name || "Student").replace(/\s+/g, "_")}_ID_Card.pdf`;
        pdf.save(filename);

        showToast("ID Card downloaded successfully!", "success");
    } catch (err) {
        console.error("PDF generation failed:", err);
        showToast("Failed to generate PDF. Please try again.", "error");
    }
}