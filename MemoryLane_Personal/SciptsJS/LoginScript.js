

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDuz1CBuKc7fwUanvUC4w0Ot5T-yaPAykQ",
  authDomain: "samdb-66322.firebaseapp.com",
  projectId: "samdb-66322",
  storageBucket: "samdb-66322.appspot.com",
  messagingSenderId: "615523111734",
  appId: "1:615523111734:web:56e1c18d7a98a7074f5997",
  measurementId: "G-0KD2CG6R8J",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

document.querySelector("#login-box .clkbtn").addEventListener("click", () => {
    const email = document.querySelector("#login-box input[type='email']").value;
    const password = document.querySelector("#login-box input[type='password']").value;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // alert("Login successful!");
            console.log("User logged in successfully:", userCredential.user);
            setTimeout(() => {
                window.location.href = "./DashBoard.html";
            }, 100);
        })
        .catch((error) => {
            // Show error message in a dedicated element instead of alert
            const errorElem = document.querySelector("#login-box .error-message");
            if (errorElem) {
                errorElem.textContent = "Invalid email or password. Please try again.";
                errorElem.style.display = "block";
            }
        });
});

document.querySelector("#signup-box .clkbtn").addEventListener("click", () => {
  const name = document.querySelector("#signup-box input[type='text']").value;
  const email = document.querySelector("#signup-box input[type='email']").value;
  const password = document.querySelector("#signup-box input[type='password']").value;

  createUserWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name,
        email
      });
      alert("Signup successful!");
    })
    .catch((error) => {
      alert("Signup failed: " + error.message);
      console.error("Error during signup:", error);
    });
});

document.querySelector(".google-btn").addEventListener("click", async () => {
    try {
        // Always sign out first to ensure a fresh login
        if (auth.currentUser) {
            await auth.signOut();
        }

        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userRef = doc(db, "users", user.email);

        // Check if user document exists, create if not
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                name: user.displayName || "",
                email: user.email
            });
            // Create a "memories" collection with the user's email as the doc ID, only if it doesn't exist
            const memoriesRef = doc(db, "memories", user.email);
            const memoriesSnap = await getDoc(memoriesRef);
            if (!memoriesSnap.exists()) {
                await setDoc(memoriesRef, {
                    memories: {}
                });
            }    await setDoc(doc(db, "memories", user.email), {
            memories: {}
        });
        }

        
        //save user data to local storage
        sessionStorage.setItem("user", JSON.stringify({
            uid: user.uid,
            name: user.displayName || "",
            email: user.email
        }));

        // Set loggedOut to false in localStorage on successful login
        localStorage.setItem("logged in", "true");    
        setTimeout(() => {
            window.location.replace("./DashBoard.html");
        }, 1000);
    } catch (error) {
        alert("Google Sign-In failed: " + error.message);
        console.error("Google Sign-In error:", error);
    }
});




