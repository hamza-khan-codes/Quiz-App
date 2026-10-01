// Quiz Assessment Management Logic

document.addEventListener("DOMContentLoaded", async () => {
    if (!await checkAdminAuth()) return;
    await Promise.all([loadCoursesDropdown(), getAllQuizzes()]);
});

const modal = document.getElementById("addQuizModal");

function openAddQuizModal() {
    modal.classList.add("show");
    document.getElementById("quizName").focus();
}

function closeAddQuizModal() {
    modal.classList.remove("show");
    document.getElementById("coursesSelect").selectedIndex = 0;
    document.getElementById("quizName").value = "";
    document.getElementById("quizDuration").value = "10";
}

async function loadCoursesDropdown() {
    const select = document.getElementById("coursesSelect");
    if (!select) return;

    try {
        const snap = await db.ref("course").get();
        if (snap.exists()) {
            const courses = Object.entries(snap.val()).map(([key, course]) => ({ ...course, coursekey: course.coursekey || key }));
            select.replaceChildren(new Option("Choose a course...", "", true, true));
            courses.forEach(course => select.add(new Option(course.courseName || "Untitled course", course.coursekey)));
        } else {
            select.innerHTML = `<option value="" disabled selected>No courses found. Create one first.</option>`;
        }
    } catch (e) {
        console.error("Error loading courses for dropdown:", e);
    }
}

async function handleCreateQuiz(event) {
    if (event) event.preventDefault();

    const select = document.getElementById("coursesSelect");
    const courseKey = select.value;
    const selectedOption = select.options[select.selectedIndex];
    const courseName = selectedOption ? selectedOption.textContent : "";
    const quizName = document.getElementById("quizName").value.trim();
    const duration = parseInt(document.getElementById("quizDuration").value) || 10;
    const saveBtn = document.getElementById("saveQuizBtn");

    if (!courseKey || !quizName) {
        showToast("Please fill in all required fields", "error");
        return;
    }

    try {
        saveBtn.disabled = true;
        saveBtn.innerText = "Creating...";

        const quizRef = db.ref("Quiz").push();
        const quizKey = quizRef.key;

        const quizObject = {
            quizKey: quizKey,
            coursekey: courseKey,
            coursesName: courseName,
            quizName: quizName,
            timeLimitMinutes: duration,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        await quizRef.set(quizObject);
        showToast("Quiz created successfully!", "success");

        closeAddQuizModal();
        getAllQuizzes();
    } catch (err) {
        console.error("Error creating quiz:", err);
        showToast("Failed to create quiz", "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Create Quiz";
    }
}

async function getAllQuizzes() {
    const tableBody = document.getElementById("quizTableBody");
    if (!tableBody) return;

    try {
        const quizSnap = await db.ref("Quiz").get();
        if (!quizSnap.exists()) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-placeholder">
                        <span class="icon">📝</span>
                        <h4>No quizzes created yet</h4>
                        <p>Click '+ Create New Quiz' above to add your first assessment.</p>
                    </td>
                </tr>
            `;
            return;
        }

        const quizzes = Object.entries(quizSnap.val()).map(([key, quiz]) => ({ ...quiz, quizKey: quiz.quizKey || key }));

        // Fetch question counts concurrently for each quiz
        const questionCounts = await Promise.all(
            quizzes.map(async (q) => {
                const questions = await fetchQuizQuestions(q.quizKey);
                return questions.length;
            })
        );

        tableBody.replaceChildren();
        quizzes.forEach((quiz, index) => {
            const qCount = questionCounts[index];
            const duration = quiz.timeLimitMinutes || 10;
            const row = tableBody.insertRow();
            row.insertCell().textContent = String(index + 1);
            const courseCell = row.insertCell();
            const courseBadge = document.createElement("span");
            courseBadge.className = "badge badge-primary";
            courseBadge.textContent = quiz.coursesName || "Course";
            courseCell.append(courseBadge);
            const nameCell = row.insertCell();
            const name = document.createElement("strong");
            name.textContent = quiz.quizName || "Untitled quiz";
            nameCell.append(name);
            const countCell = row.insertCell();
            const countBadge = document.createElement("span");
            countBadge.className = `badge ${qCount > 0 ? "badge-success" : "badge-warning"}`;
            countBadge.textContent = `${qCount} question${qCount === 1 ? "" : "s"}`;
            countCell.append(countBadge);
            row.insertCell().textContent = `${duration} min`;
            const actionCell = row.insertCell();
            const actions = document.createElement("div");
            actions.style.cssText = "display:flex; gap:8px; flex-wrap:wrap;";
            const manageLink = document.createElement("a");
            manageLink.className = "btn btn-primary btn-sm";
            manageLink.href = `Questions.html?courseKey=${encodeURIComponent(quiz.coursekey || "")}&quizKey=${encodeURIComponent(quiz.quizKey)}`;
            manageLink.textContent = "Manage questions";
            const deleteButton = document.createElement("button");
            deleteButton.className = "btn btn-outline-danger btn-sm";
            deleteButton.textContent = "Delete";
            deleteButton.addEventListener("click", () => deleteQuiz(quiz.quizKey, quiz.quizName));
            actions.append(manageLink, deleteButton);
            actionCell.append(actions);
        });

    } catch (err) {
        console.error("Error fetching quizzes:", err);
        showToast("Failed to load quizzes", "error");
    }
}

async function deleteQuiz(quizKey, quizName) {
    if (!confirm(`Are you sure you want to delete quiz "${quizName}" and its associated questions?`)) {
        return;
    }

    try {
        await Promise.all([
            db.ref("Quiz").child(quizKey).remove(),
            db.ref(" Questions").child(quizKey).remove(),
            db.ref("Questions").child(quizKey).remove()
        ]);

        showToast(`Quiz "${quizName}" deleted`, "info");
        getAllQuizzes();
    } catch (err) {
        console.error("Error deleting quiz:", err);
        showToast("Failed to delete quiz", "error");
    }
}