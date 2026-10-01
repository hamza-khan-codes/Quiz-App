let currentQuizKey = "";
let currentCourseKey = "";

document.addEventListener("DOMContentLoaded", initializeQuestionBank);

async function initializeQuestionBank() {
    if (!await checkAdminAuth()) return;
    const params = new URLSearchParams(window.location.search);
    currentQuizKey = params.get("quizKey") || "";
    currentCourseKey = params.get("courseKey") || "";
    if (!currentQuizKey) {
        window.location.replace("quiz.html");
        return;
    }

    try {
        const quizSnapshot = await db.ref("Quiz").child(currentQuizKey).get();
        if (!quizSnapshot.exists()) throw new Error("Quiz not found.");
        const quiz = quizSnapshot.val();
        currentCourseKey = currentCourseKey || quiz.coursekey || "";
        document.getElementById("questionQuizTitle").textContent = `${quiz.quizName || "Assessment"} · ${quiz.coursesName || "Course"}`;
        await loadQuestions();
    } catch (error) {
        console.error("Could not open question bank:", error);
        showToast(error.message || "Could not load this question bank.", "error");
    }
}

async function handleAddQuestion(event) {
    event.preventDefault();
    const questionText = document.getElementById("questionText").value.trim();
    const options = [...document.querySelectorAll(".question-option")].map(input => input.value.trim());
    const correctIndex = Number(document.getElementById("correctAnswer").value);
    const saveButton = document.getElementById("saveQuestionBtn");

    if (!questionText || options.some(option => !option) || new Set(options).size !== options.length) {
        showToast("Enter a question and four different choices.", "error");
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    try {
        const questionRef = db.ref("Questions").child(currentQuizKey).push();
        await questionRef.set({
            courseKey: currentCourseKey,
            quizKey: currentQuizKey,
            question: questionText,
            options,
            correctAnswers: options[correctIndex],
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        document.getElementById("questionForm").reset();
        showToast("Question added to the quiz.", "success");
        await loadQuestions();
    } catch (error) {
        console.error("Could not save question:", error);
        showToast("Question could not be saved. Check database access.", "error");
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Add question";
    }
}

async function loadQuestions() {
    const tableBody = document.getElementById("courseTable");
    const countLabel = document.getElementById("questionCountLabel");
    const questions = await fetchQuizQuestions(currentQuizKey);
    countLabel.textContent = `${questions.length} question${questions.length === 1 ? "" : "s"}`;
    tableBody.replaceChildren();

    if (questions.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.className = "empty-placeholder";
        cell.textContent = "No questions yet. Add the first one above.";
        return;
    }

    questions.forEach((question, index) => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = String(index + 1);
        row.insertCell().textContent = question.question || question.prompt || "Question";
        row.insertCell().textContent = (question.options || []).join(" · ");
        const correctAnswers = Array.isArray(question.correctAnswers) ? question.correctAnswers : [question.correctAnswers];
        row.insertCell().textContent = correctAnswers.filter(Boolean).join(", ") || "Not set";
        const actionCell = row.insertCell();
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "btn btn-outline-danger btn-sm";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", () => removeQuestion(question.id));
        actionCell.append(removeButton);
    });
}

async function removeQuestion(questionKey) {
    if (!window.confirm("Remove this question from the quiz?")) return;
    try {
        await db.ref("Questions").child(currentQuizKey).child(questionKey).remove();
        await db.ref(" Questions").child(currentQuizKey).child(questionKey).remove();
        showToast("Question removed.", "success");
        await loadQuestions();
    } catch (error) {
        console.error("Could not remove question:", error);
        showToast("Question could not be removed.", "error");
    }
}
