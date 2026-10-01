// Student Directory Business Logic

let allStudents = [];
let allResults = [];

document.addEventListener("DOMContentLoaded", async () => {
    if (await checkAdminAuth()) await loadAllStudents();
});

async function loadAllStudents() {
    const tableBody = document.getElementById("usersTableBody");
    const countLabel = document.getElementById("studentCountLabel");
    if (!tableBody) return;

    try {
        const [usersSnap, resultsSnap] = await Promise.all([
            db.ref("user").get(),
            db.ref("quizResults").get()
        ]);

        if (!usersSnap.exists()) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-placeholder">
                        <span class="icon">👨‍🎓</span>
                        <h4>No registered students found</h4>
                        <p>When students sign up on the portal, they will appear here.</p>
                    </td>
                </tr>
            `;
            if (countLabel) countLabel.innerText = "0 students registered";
            return;
        }

        allStudents = Object.entries(usersSnap.val()).map(([uid, u]) => ({
            uid,
            ...u
        }));

        allResults = resultsSnap.exists() ? flattenQuizResults(resultsSnap.val()) : [];

        if (countLabel) {
            countLabel.innerText = `Total ${allStudents.length} registered student${allStudents.length === 1 ? '' : 's'}`;
        }

        renderStudentsList(allStudents);

    } catch (err) {
        console.error("Error loading students:", err);
        showToast("Failed to load student directory", "error");
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

function renderStudentsList(students) {
    const tableBody = document.getElementById("usersTableBody");
    if (!tableBody) return;

    if (students.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-placeholder">
                    <span class="icon">🔍</span>
                    <h4>No matching students found</h4>
                    <p>Try searching for a different name or email address.</p>
                </td>
            </tr>
        `;
        return;
    }

    // Count attempts per user
    const attemptsMap = {};
    allResults.forEach(r => {
        if (r.userId) {
            attemptsMap[r.userId] = (attemptsMap[r.userId] || 0) + 1;
        }
    });

    tableBody.innerHTML = students.map((std, idx) => {
        const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(std.name || 'Student')}`;
        const avatarUrl = /^https?:\/\//i.test(std.image || "") ? std.image : defaultAvatar;
        const joinedDate = std.createdAt ? new Date(std.createdAt).toLocaleDateString() : "Active";
        const attempts = attemptsMap[std.uid] || 0;

        return `
            <tr>
                <td>${idx + 1}</td>
                <td>
                    <div class="user-cell">
                        <img src="${escapeHTML(avatarUrl)}" alt="${escapeHTML(std.name || 'Student')}" onerror="this.src='${defaultAvatar}'">
                        <div class="user-cell-info">
                            <h4>${escapeHTML(std.name || "Unnamed Student")}</h4>
                            <span>ID: ${std.uid ? std.uid.substring(0, 8) : 'N/A'}</span>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(std.email || "N/A")}</td>
                <td><span class="badge badge-primary">${escapeHTML(std.course || "MERN Stack")}</span></td>
                <td>${joinedDate}</td>
                <td>
                    <span class="badge ${attempts > 0 ? 'badge-success' : 'badge-neutral'}">
                        ${attempts} Test${attempts === 1 ? '' : 's'}
                    </span>
                </td>
            </tr>
        `;
    }).join("");
}

function filterStudents() {
    const query = document.getElementById("studentSearchInput").value.trim().toLowerCase();
    if (!query) {
        renderStudentsList(allStudents);
        return;
    }

    const filtered = allStudents.filter(std => {
        const name = (std.name || "").toLowerCase();
        const email = (std.email || "").toLowerCase();
        const course = (std.course || "").toLowerCase();
        return name.includes(query) || email.includes(query) || course.includes(query);
    });

    renderStudentsList(filtered);
}