# Firebase setup

The user and admin portals now use the same Firebase project (`quiz-app-a7554`) and Firebase Authentication with Realtime Database.

## Enable the project

1. In Firebase Console, enable **Authentication → Sign-in method → Email/Password** and **Google**.
2. Add the domain you use to serve the app to **Authentication → Settings → Authorized domains**. For local development, open the app at `http://localhost:8000/` (`localhost` is already authorized in most Firebase projects).
3. Confirm the Realtime Database is created for `quiz-app-a7554`.
4. Publish the rules in `database.rules.json` from **Realtime Database → Rules**.
5. Create the first administrator account in Authentication. In the database, create `admins/{AUTH_UID}/role` with the string value `admin`. Do this in the Firebase Console, which has privileged access, before signing in to the admin portal.
6. Serve this folder over HTTP (for example, `python -m http.server 8000`) and open `index.html` at `http://localhost:8000/`.

The Firebase web configuration is public by design. Access control comes from Authentication and database rules, not from hiding the API key.

## Data layout

- `user/{uid}` stores each student profile.
- `course/{courseKey}` stores course metadata.
- `Quiz/{quizKey}` stores an assessment and its course reference.
- `Questions/{quizKey}/{questionKey}` stores its question bank. The reader still accepts the old ` Questions` node for compatibility.
- `quizResults/{uid}/{attemptKey}` stores each student's score history.
- `admins/{uid}/role` grants administrator access when its value is `admin`.

## Existing Firebase data

The previous user portal pointed to a different project (`quiz-98a65`). The app now uses the admin project's `quiz-app-a7554` so both portals share data. Existing Authentication accounts and database records are not moved automatically; migrate them in Firebase Console or have those students register again in the shared project.

## Assessment security note

The browser currently loads answer keys and calculates scores so this static HTML/JavaScript app can grade without a server. A student can inspect those answers or alter a submitted score. These rules protect profiles and limit who can write quiz content, but they do not make client-side grading trustworthy. Use a trusted Cloud Function or other server-side grader before using the app for high-stakes assessments.
