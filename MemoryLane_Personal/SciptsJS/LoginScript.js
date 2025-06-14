// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDuz1CBuKc7fwUanvUC4w0Ot5T-yaPAykQ",
  authDomain: "samdb-66322.firebaseapp.com",
  projectId: "samdb-66322",
  storageBucket: "samdb-66322.appspot.com",
  messagingSenderId: "615523111734",
  appId: "1:615523111734:web:56e1c18d7a98a7074f5997",
  measurementId: "G-0KD2CG6R8J",
};

// Firebase init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

function toggleLoader(show = true) {
  let loader = document.querySelector("#loader-modal");
  if (show) loader?.classList.add("show");
  else loader?.classList.remove("show");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast-message";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showError(formId, message) {
  const errorElem = document.querySelector(`${formId} .error-message`);
  if (errorElem) {
    errorElem.textContent = message;
    errorElem.style.display = "block";
  }
}

function clearError(formId) {
  const errorElem = document.querySelector(`${formId} .error-message`);
  if (errorElem) {
    errorElem.textContent = "";
    errorElem.style.display = "none";
  }
}

async function initializeUserData(user, name = "") {
  const userRef = doc(db, "users", user.email);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      name: name || user.displayName || "",
      email: user.email,
    });
  }

  const memoriesRef = doc(db, "memories", user.email);
  const memoriesSnap = await getDoc(memoriesRef);
  if (!memoriesSnap.exists()) {
    await setDoc(memoriesRef, { memories: {} });
  }
}

// Login form handling
document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError("#login-box");
  toggleLoader(true);

  const email = document.querySelector("#login-box input[type='email']").value.trim();
  const password = document.querySelector("#login-box input[type='password']").value;

  if (!email || !password) {
    showError("#login-box", "Please enter both email and password.");
    toggleLoader(false);
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    sessionStorage.setItem("user", JSON.stringify({ uid: userCredential.user.uid, email }));
    localStorage.setItem("logged in", "true");

    event.target.reset();
    toggleLoader(false);

    history.pushState(null, null, location.href);
    window.onpopstate = function () {
      history.go(1);
    };

    window.location.replace("./DashBoard.html");
  } catch (error) {
    showError("#login-box", "Invalid email or password. Please try again.");
    event.target.reset();
    toggleLoader(false);
  }
});


// Sign-up form handling
document.querySelector("#signup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError("#signup-box");
  toggleLoader(true);

  const name = document.querySelector("#signup-box input[type='text']").value.trim();
  const email = document.querySelector("#signup-box input[type='email']").value.trim();
  const password = document.querySelector("#signup-box input[type='password']").value;

  if (!name || !email || !password) {
    showError("#signup-box", "Please fill in all fields.");
    toggleLoader(false);
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await initializeUserData(userCredential.user, name);

    sessionStorage.setItem("user", JSON.stringify({ uid: userCredential.user.uid, name, email }));
    localStorage.setItem("logged in", "true");

    event.target.reset();
    toggleLoader(false);
    showToast("Sign up successful! Login now.");
    document.getElementById("loginToggle").click();
  } catch (error) {
    showError("#signup-box", error.message);
    event.target.reset();
    toggleLoader(false);
  }
});

document.querySelector(".google-btn").addEventListener("click", async () => {
  try {
    toggleLoader(true);
    if (auth.currentUser) await signOut(auth);

    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    await initializeUserData(user);

    sessionStorage.setItem("user", JSON.stringify({ uid: user.uid, name: user.displayName || "", email: user.email }));
    localStorage.setItem("logged in", "true");

    toggleLoader(false);
    window.location.replace("./DashBoard.html");
  } catch (error) {
    toggleLoader(false);
    alert("Google Sign-In failed: " + error.message);
  }
});


