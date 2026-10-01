// Course Management Business Logic

document.addEventListener("DOMContentLoaded", async () => {
    if (await checkAdminAuth()) await getAllCourses();
});

const modal = document.getElementById("addCourseModal");

function openAddCourseModal() {
    modal.classList.add("show");
    document.getElementById("courseName").focus();
}

function closeAddCourseModal() {
    modal.classList.remove("show");
    document.getElementById("courseName").value = "";
    document.getElementById("courseduration").value = "";
    document.getElementById("coursefee").value = "";
}

async function handleCreateCourse(event) {
    if (event) event.preventDefault();

    const courseName = document.getElementById("courseName").value.trim();
    const courseduration = document.getElementById("courseduration").value.trim();
    const coursefee = document.getElementById("coursefee").value.trim();
    const saveBtn = document.getElementById("saveCourseBtn");

    if (!courseName || !courseduration || !coursefee) {
        showToast("Please fill in all fields", "error");
        return;
    }

    try {
        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";

        const courseRef = db.ref("course").push();
        const courseKey = courseRef.key;

        const newCourse = {
            coursekey: courseKey,
            courseName: courseName,
            courseduration: courseduration,
            coursefee: coursefee,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        await courseRef.set(newCourse);
        showToast("Course created successfully!", "success");

        closeAddCourseModal();
        getAllCourses();
    } catch (err) {
        console.error("Error creating course:", err);
        showToast("Failed to create course", "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Save Course";
    }
}

async function getAllCourses() {
    const tableBody = document.getElementById("courseTable");
    if (!tableBody) return;

    try {
        const [courseSnap, quizSnap] = await Promise.all([
            db.ref("course").get(),
            db.ref("Quiz").get()
        ]);

        if (!courseSnap.exists()) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-placeholder">
                        <span class="icon">📚</span>
                        <h4>No courses available</h4>
                        <p>Click '+ Add New Course' above to create one.</p>
                    </td>
                </tr>
            `;
            return;
        }

        const courses = Object.entries(courseSnap.val()).map(([key, course]) => ({ ...course, coursekey: course.coursekey || key }));
        const quizzes = quizSnap.exists() ? Object.values(quizSnap.val()) : [];

        // Count quizzes per course
        const quizCountByCourse = {};
        quizzes.forEach(q => {
            const cKey = q.coursekey;
            if (cKey) {
                quizCountByCourse[cKey] = (quizCountByCourse[cKey] || 0) + 1;
            }
        });

        tableBody.replaceChildren();
        courses.forEach((course, index) => {
            const quizCount = quizCountByCourse[course.coursekey] || 0;
            const row = tableBody.insertRow();
            row.insertCell().textContent = String(index + 1);
            const nameCell = row.insertCell();
            const name = document.createElement("strong");
            name.textContent = course.courseName || "Untitled course";
            nameCell.append(name);
            row.insertCell().textContent = course.courseduration || "—";
            const feeCell = row.insertCell();
            const feeBadge = document.createElement("span");
            feeBadge.className = "badge badge-neutral";
            feeBadge.textContent = course.coursefee || "—";
            feeCell.append(feeBadge);
            const quizCell = row.insertCell();
            const quizBadge = document.createElement("span");
            quizBadge.className = "badge badge-primary";
            quizBadge.textContent = `${quizCount} assessment${quizCount === 1 ? "" : "s"}`;
            quizCell.append(quizBadge);
            const actionCell = row.insertCell();
            const deleteButton = document.createElement("button");
            deleteButton.className = "btn btn-outline-danger btn-sm";
            deleteButton.textContent = "Delete";
            deleteButton.addEventListener("click", () => deleteCourse(course.coursekey, course.courseName));
            actionCell.append(deleteButton);
        });

    } catch (err) {
        console.error("Error fetching courses:", err);
        showToast("Failed to load courses", "error");
    }
}

async function deleteCourse(courseKey, courseName) {
    if (!confirm(`Are you sure you want to delete "${courseName}"? This will not delete past quiz records.`)) {
        return;
    }

    try {
        await db.ref("course").child(courseKey).remove();
        showToast(`Course "${courseName}" deleted.`, "info");
        getAllCourses();
    } catch (err) {
        console.error("Error deleting course:", err);
        showToast("Failed to delete course", "error");
    }
}