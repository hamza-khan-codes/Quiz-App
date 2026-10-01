// Admin Dashboard Business Logic

document.addEventListener("DOMContentLoaded", async () => {
    if (await checkAdminAuth()) await initializeDashboard();
});

async function initializeDashboard() {
    const adminEmail = auth.currentUser?.email || "Administrator";
    const adminDisplay = document.getElementById("adminNameDisplay");
    if (adminDisplay) {
        adminDisplay.innerText = adminEmail.split("@")[0];
    }

    await loadMetricsAndTables();
}

async function loadMetricsAndTables() {
    try {
        // 1. Fetch Students
        const userSnap = await db.ref("user").get();
        const users = userSnap.exists() ? Object.values(userSnap.val()) : [];
        document.getElementById("totalstd").innerText = users.length;

        // 2. Fetch Courses
        const courseSnap = await db.ref("course").get();
        const courses = courseSnap.exists() ? Object.values(courseSnap.val()) : [];
        document.getElementById("totalCourse").innerText = courses.length;

        // 3. Fetch Quizzes
        const quizSnap = await db.ref("Quiz").get();
        const quizzes = quizSnap.exists() ? Object.values(quizSnap.val()) : [];
        document.getElementById("totalQuiz").innerText = quizzes.length;

        // 4. Fetch Questions (aggregate across both legacy and new nodes)
        let totalQuestionCount = 0;
        let qSnap = await db.ref(" Questions").get();
        if (qSnap.exists()) {
            const raw = qSnap.val();
            Object.values(raw).forEach(quizQuestions => {
                totalQuestionCount += Object.keys(quizQuestions).length;
            });
        }
        let qSnap2 = await db.ref("Questions").get();
        if (qSnap2.exists()) {
            const raw2 = qSnap2.val();
            Object.values(raw2).forEach(quizQuestions => {
                totalQuestionCount += Object.keys(quizQuestions).length;
            });
        }
        document.getElementById("totalQuestions").innerText = totalQuestionCount;

        // 5. Fetch Quiz Submissions
        const resultsSnap = await db.ref("quizResults").get();
        const results = resultsSnap.exists() ? flattenQuizResults(resultsSnap.val()) : [];
        document.getElementById("totalAttempts").innerText = results.length;

        // Render Recent Submissions Table
        renderRecentSubmissions(results);

        // Render Recent Students Table
        renderRecentStudents(users);

    } catch (err) {
        console.error("Dashboard data load error:", err);
        showToast("Error loading dashboard data", "error");
    }
}

function flattenQuizResults(rawResults) {
    return Object.entries(rawResults || {}).flatMap(([uid, value]) => {
        if (!value || typeof value !== "object") return [];
        if (value.userId) return [value];
        return Object.values(value).filter(result => result && typeof result === "object").map(result => ({
            ...result,
            userId: result.userId || uid
        }));
    });
}

function renderRecentSubmissions(submissions) {
    const tableBody = document.getElementById("recentSubmissionsTable");
    if (!tableBody) return;

    if (!submissions || submissions.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-placeholder">
                    <span class="icon">📝</span>
                    <h4>No quiz submissions recorded yet</h4>
                    <p>When students take quizzes, their results will appear here live.</p>
                </td>
            </tr>
        `;
        return;
    }

    // Sort descending by timestamp
    const sorted = [...submissions].sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));

    tableBody.innerHTML = sorted.slice(0, 8).map(sub => {
        const isPassed = sub.percentage >= 50;
        const statusBadge = isPassed
            ? `<span class="badge badge-success">Passed</span>`
            : `<span class="badge badge-danger">Failed</span>`;
        const dateStr = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "Recent";

        return `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar" style="background:#eef2ff; color:#4f46e5; display:flex; align-items:center; justify-content:center; font-weight:bold;">
                            ${escapeHTML((sub.userName || "S")[0].toUpperCase())}
                        </div>
                        <div class="user-cell-info">
                            <h4>${escapeHTML(sub.userName || "Student")}</h4>
                            <span>${escapeHTML(sub.userEmail || "N/A")}</span>
                        </div>
                    </div>
                </td>
                <td><strong>${escapeHTML(sub.quizName || "Quiz")}</strong></td>
                <td>${escapeHTML(sub.courseName || "General")}</td>
                <td>${escapeHTML(sub.score)} / ${escapeHTML(sub.totalQuestions)}</td>
                <td><strong>${escapeHTML(sub.percentage)}%</strong></td>
                <td>${statusBadge}</td>
                <td>${dateStr}</td>
            </tr>
        `;
    }).join("");
}

function renderRecentStudents(users) {
    const tableBody = document.getElementById("recentStudentsTable");
    if (!tableBody) return;

    if (!users || users.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-placeholder">
                    <span class="icon">👨‍🎓</span>
                    <h4>No registered students found</h4>
                </td>
            </tr>
        `;
        return;
    }

    // Reverse for most recent first
    const sorted = [...users].reverse();

    tableBody.innerHTML = sorted.slice(0, 5).map((user, idx) => {
        const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || 'Student')}`;
        const avatarUrl = /^https?:\/\//i.test(user.image || "") ? user.image : defaultAvatar;
        const joinedDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Active";

        return `
            <tr>
                <td>${idx + 1}</td>
                <td>
                    <div class="user-cell">
                        <img src="${escapeHTML(avatarUrl)}" alt="${escapeHTML(user.name || "Student")}" onerror="this.src='${defaultAvatar}'">
                        <div class="user-cell-info">
                            <h4>${escapeHTML(user.name || "Student")}</h4>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(user.email || "N/A")}</td>
                <td><span class="badge badge-primary">${escapeHTML(user.course || "MERN Stack")}</span></td>
                <td>${joinedDate}</td>
            </tr>
        `;
    }).join("");
}