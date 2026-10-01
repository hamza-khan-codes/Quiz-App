let activeQuiz = null;
let questions = [];
let answers = [];
let questionIndex = 0;
let secondsRemaining = 0;
let timerInterval = null;
let hasSubmitted = false;
let activeUser = null;

document.addEventListener("DOMContentLoaded", initializeQuizPage);

async function initializeQuizPage() {
    activeUser = auth.currentUser || await new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            unsubscribe();
            resolve(user);
        });
    });

    if (!activeUser) {
        window.location.replace("login.html");
        return;
    }

    const quizKey = new URLSearchParams(window.location.search).get("quizKey");
    if (quizKey) {
        await loadQuiz(quizKey);
    } else {
        await loadQuizPicker();
    }
}

async function loadQuizPicker() {
    const picker = document.getElementById("quizPickerCard");
    const player = document.getElementById("quizCard");
    const select = document.getElementById("directQuizSelect");
    if (!picker || !select) return;

    player.style.display = "none";
    picker.style.display = "block";
    try {
        const snapshot = await db.ref("Quiz").get();
        const quizzes = snapshot.exists() ? Object.entries(snapshot.val()) : [];
        select.replaceChildren(new Option("Choose an assessment...", ""));

        for (const [key, quiz] of quizzes) {
            select.add(new Option(`${quiz.quizName || "Untitled quiz"} · ${quiz.coursesName || "Course"}`, key));
        }
        if (quizzes.length === 0) {
            select.replaceChildren(new Option("No quizzes are available", ""));
            showToast("There are no published quizzes yet.", "info");
        }
    } catch (error) {
        console.error("Could not load quizzes:", error);
        select.replaceChildren(new Option("Unable to load quizzes", ""));
        showToast("Could not load available quizzes.", "error");
    }
}

async function startSelectedQuiz() {
    const quizKey = document.getElementById("directQuizSelect")?.value;
    if (!quizKey) {
        showToast("Choose a quiz to continue.", "error");
        return;
    }
    await loadQuiz(quizKey);
}

async function loadQuiz(quizKey) {
    try {
        const quizSnapshot = await db.ref("Quiz").child(quizKey).get();
        if (!quizSnapshot.exists()) throw new Error("This quiz is no longer available.");

        activeQuiz = { key: quizKey, ...quizSnapshot.val() };
        questions = await fetchQuizQuestions(quizKey);
        if (questions.length === 0) throw new Error("This quiz does not have any questions yet.");

        answers = Array.from({ length: questions.length }, () => []);
        questionIndex = 0;
        hasSubmitted = false;
        document.getElementById("quizPickerCard").style.display = "none";
        document.getElementById("resultCard").style.display = "none";
        document.getElementById("quizCard").style.display = "block";
        document.getElementById("quizTitleDisplay").textContent = activeQuiz.quizName || "Assessment";
        document.getElementById("quizCourseDisplay").textContent = activeQuiz.coursesName || "Course assessment";

        secondsRemaining = Math.max(1, Number(activeQuiz.timeLimitMinutes) || 10) * 60;
        updateTimer();
        window.clearInterval(timerInterval);
        timerInterval = window.setInterval(() => {
            secondsRemaining -= 1;
            updateTimer();
            if (secondsRemaining <= 0) submitQuiz(true);
        }, 1000);
        renderQuestion();
    } catch (error) {
        console.error("Could not start quiz:", error);
        showToast(error.message || "Could not start this quiz.", "error");
        if (new URLSearchParams(window.location.search).has("quizKey")) {
            window.setTimeout(() => window.location.replace("dashboard.html"), 1400);
        }
    }
}

function updateTimer() {
    const minutes = Math.floor(secondsRemaining / 60).toString().padStart(2, "0");
    const seconds = (secondsRemaining % 60).toString().padStart(2, "0");
    const timerText = document.getElementById("timerText");
    const timerPill = document.getElementById("timerPill");
    if (timerText) timerText.textContent = `${minutes}:${seconds}`;
    if (timerPill) timerPill.classList.toggle("is-low", secondsRemaining <= 60);
}

function renderQuestion() {
    const question = questions[questionIndex];
    const title = document.getElementById("questionTitle");
    const optionsContainer = document.getElementById("optionsContainer");
    const counter = document.getElementById("questionCounter");
    const progress = document.getElementById("quizProgressBar");
    const previousButton = document.getElementById("prevBtn");
    const nextButton = document.getElementById("nextBtn");

    title.textContent = question.question || question.prompt || "Question";
    counter.textContent = `Question ${questionIndex + 1} of ${questions.length}`;
    progress.style.width = `${((questionIndex + 1) / questions.length) * 100}%`;
    optionsContainer.replaceChildren();

    (question.options || []).forEach((optionText, optionIndex) => {
        const item = document.createElement("li");
        const input = document.createElement("input");
        const inputId = `answer-${questionIndex}-${optionIndex}`;
        input.type = questionAllowsMultipleAnswers(question) ? "checkbox" : "radio";
        input.name = `question-${questionIndex}`;
        input.id = inputId;
        input.value = String(optionIndex);
        input.checked = answers[questionIndex].includes(optionIndex);

        const label = document.createElement("label");
        label.htmlFor = inputId;
        label.textContent = optionText;
        input.addEventListener("change", () => {
            if (input.type === "radio") {
                answers[questionIndex] = [optionIndex];
            } else if (input.checked) {
                answers[questionIndex].push(optionIndex);
            } else {
                answers[questionIndex] = answers[questionIndex].filter(index => index !== optionIndex);
            }
            nextButton.disabled = answers[questionIndex].length === 0;
        });

        item.append(input, label);
        optionsContainer.append(item);
    });

    previousButton.style.display = questionIndex === 0 ? "none" : "inline-flex";
    nextButton.textContent = questionIndex === questions.length - 1 ? "Submit assessment" : "Next question";
    nextButton.disabled = answers[questionIndex].length === 0;
}

function questionAllowsMultipleAnswers(question) {
    const correct = question.correctAnswers;
    return Array.isArray(correct) && correct.length > 1;
}

function goToPreviousQuestion() {
    if (questionIndex === 0) return;
    questionIndex -= 1;
    renderQuestion();
}

function handleNextOrSubmit() {
    if (answers[questionIndex].length === 0) return;
    if (questionIndex === questions.length - 1) {
        submitQuiz(false);
        return;
    }
    questionIndex += 1;
    renderQuestion();
}

async function submitQuiz(timedOut) {
    if (hasSubmitted) return;
    hasSubmitted = true;
    window.clearInterval(timerInterval);

    const correctOptionIndexes = questions.map(question => {
        const correctAnswers = Array.isArray(question.correctAnswers)
            ? question.correctAnswers
            : [question.correctAnswers];
        return correctAnswers.map(answer => (question.options || []).indexOf(answer)).filter(index => index >= 0).sort();
    });
    const correctCount = correctOptionIndexes.reduce((count, correct, index) => {
        const selected = [...answers[index]].sort();
        return count + (selected.length === correct.length && selected.every((value, position) => value === correct[position]) ? 1 : 0);
    }, 0);
    const percentage = Math.round((correctCount / questions.length) * 100);

    try {
        const profileSnapshot = await db.ref("user").child(activeUser.uid).get();
        const profile = profileSnapshot.val() || {};
        const resultRef = db.ref("quizResults").child(activeUser.uid).push();
        await resultRef.set({
            userId: activeUser.uid,
            userName: profile.name || localStorage.getItem("userName") || activeUser.email.split("@")[0],
            userEmail: activeUser.email,
            quizKey: activeQuiz.key,
            quizName: activeQuiz.quizName || "Assessment",
            courseName: activeQuiz.coursesName || "General",
            score: correctCount,
            totalQuestions: questions.length,
            percentage,
            timedOut: Boolean(timedOut),
            submittedAt: firebase.database.ServerValue.TIMESTAMP
        });
    } catch (error) {
        console.error("Could not save quiz result:", error);
        showToast("Your score is ready, but could not be saved. Check your connection.", "error");
    }

    showResult(correctCount, percentage, timedOut);
}

function showResult(correctCount, percentage, timedOut) {
    document.getElementById("quizCard").style.display = "none";
    document.getElementById("resultCard").style.display = "block";
    document.getElementById("resultHeading").textContent = timedOut ? "Time is up" : "Assessment complete";
    document.getElementById("resultSubheading").textContent = timedOut
        ? "Your answers were submitted when the timer ended."
        : "Your score has been recorded in your results.";
    document.getElementById("resultPercentage").textContent = `${percentage}%`;
    document.getElementById("resultTotal").textContent = questions.length;
    document.getElementById("resultCorrect").textContent = correctCount;
    document.getElementById("resultWrong").textContent = questions.length - correctCount;
    document.getElementById("resultGradeLabel").textContent = percentage >= 50 ? "Passed" : "Keep practicing";
    document.getElementById("resultEmoji").textContent = percentage >= 50 ? "✓" : "↗";
    renderAnswerReview();
}

function renderAnswerReview() {
    const list = document.getElementById("reviewList");
    list.replaceChildren();
    questions.forEach((question, index) => {
        const correctAnswers = Array.isArray(question.correctAnswers) ? question.correctAnswers : [question.correctAnswers];
        const article = document.createElement("article");
        article.className = "review-item";
        const heading = document.createElement("h4");
        heading.textContent = `${index + 1}. ${question.question || question.prompt || "Question"}`;
        const answer = document.createElement("p");
        answer.textContent = `Your answer: ${answers[index].map(optionIndex => question.options[optionIndex]).join(", ") || "No answer"}`;
        const correct = document.createElement("p");
        correct.textContent = `Correct answer: ${correctAnswers.join(", ")}`;
        article.append(heading, answer, correct);
        list.append(article);
    });
}

function toggleAnswerReview() {
    const review = document.getElementById("reviewContainer");
    review.style.display = review.style.display === "none" ? "block" : "none";
}
