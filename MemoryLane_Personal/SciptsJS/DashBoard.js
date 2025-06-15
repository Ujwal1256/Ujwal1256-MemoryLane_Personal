// Constants for reusable values
const CLOUDINARY_UPLOAD_PRESET = "memories"; // Cloudinary upload preset
const CLOUDINARY_BASE_URL = "https://api.cloudinary.com/v1_1/dwt3fmnmm"; // Cloudinary base URL
const FIRESTORE_BASE_URL =
  "https://firestore.googleapis.com/v1/projects/samdb-66322/databases/(default)/documents"; // Firestore base URL

// Cached DOM elements for performance
const DOM = {
  loaderModal: document.querySelector("#loader-modal"),
  memoryForm: document.getElementById("memoryForm"),
  memoriesList: document.getElementById("memories-list"),
  searchInput: document.getElementById("searchInput"),
  themeToggle: document.getElementById("themeToggle"),
  voiceNotesList: document.getElementById("voiceNotesList"),
  addVoiceNoteBtn: document.getElementById("add-voice-note-btn"),
  startRecordingBtn: document.getElementById("startRecordingBtn"),
  stopRecordingBtn: document.getElementById("stopRecordingBtn"),
  recordingStatus: document.getElementById("recordingStatus"),
  voiceNotePreview: document.getElementById("voiceNotePreview"),
  saveVoiceNoteBtn: document.getElementById("saveVoiceNoteBtn"),
  voiceNoteTitle: document.getElementById("voiceNoteTitle"),
};

// User data from sessionStorage
const user = JSON.parse(sessionStorage.getItem("user") || "{}");
const userEmail = user?.email;

// Global variables
let memoryEntries = []; // Store fetched memories
let mediaRecorder = null; // MediaRecorder for voice recording
let audioChunks = []; // Store audio data during recording

// Utility: Toggle loader visibility
function toggleLoader(show = true) {
  DOM.loaderModal?.classList.toggle("show", show);
}

// Utility: Log out user and redirect
async function LogOut() {
  try {
    sessionStorage.clear();
    sessionStorage.setItem("signedIn", "false");
    window.location.replace("index.html");
  } catch (error) {
    console.error("Logout failed:", error);
  }
}

// Utility: Redirect unauthorized users
function redirectUnauthorized() {
  if (!userEmail && sessionStorage.getItem("signedIn") === "false") {
    sessionStorage.removeItem("signedIn");
    window.location.replace("index.html");
  }
}

// Memory: Upload memory to Cloudinary and Firestore
async function uploadMemory() {
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("addMemoryModal")
  );
  const fields = {
    title: document.getElementById("title").value,
    notes: document.getElementById("notes").value,
    tags: document.getElementById("tags").value,
    location: document.getElementById("location").value,
    mediaFile: document.getElementById("media").files[0],
  };

  if (!fields.mediaFile || !userEmail) {
    alert("Missing media file or user session.");
    return;
  }

  try {
    toggleLoader(true);

    // Upload to Cloudinary
    const formData = new FormData();
    formData.append("file", fields.mediaFile);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    const isVideo = fields.mediaFile.type.startsWith("video/");
    const uploadUrl = `${CLOUDINARY_BASE_URL}/${
      isVideo ? "video" : "image"
    }/upload`;

    const cloudRes = await fetch(uploadUrl, { method: "POST", body: formData });
    const cloudData = await cloudRes.json();
    if (!cloudRes.ok) throw new Error("Cloudinary upload failed");
    const mediaUrl = cloudData.secure_url;

    // Prepare Firestore data
    const memoryKey = `memory_${Date.now()}`;
    const memoryFields = {
      title: { stringValue: fields.title },
      notes: { stringValue: fields.notes },
      location: { stringValue: fields.location },
      mediaUrl: { stringValue: mediaUrl },
      timestamp: { stringValue: new Date().toISOString() },
      tags: {
        arrayValue: {
          values: fields.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => ({ stringValue: t })),
        },
      },
    };

    const docUrl = `${FIRESTORE_BASE_URL}/memories/${userEmail}`;
    const getRes = await fetch(docUrl);
    const docData = await getRes.json();
    const existingMemories = docData.fields?.memories?.mapValue?.fields || {};

    // Update Firestore
    const updatedMemories = {
      ...existingMemories,
      [memoryKey]: { mapValue: { fields: memoryFields } },
    };
    const body = {
      fields: { memories: { mapValue: { fields: updatedMemories } } },
    };
    const patchRes = await fetch(`${docUrl}?currentDocument.exists=true`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!patchRes.ok) throw new Error("Failed to store memory");

    DOM.memoryForm.reset();
    modal?.hide();
    await fetchMemories();
  } catch (error) {
    console.error("Upload failed:", error);
    alert("Failed to upload memory.");
  } finally {
    toggleLoader(false);
  }
}

// Utility: Format ISO timestamp to readable string
function formatTimestamp(isoString) {
  if (!isoString) return "Date Unknown";

  try {
    const date = new Date(isoString);
    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch (err) {
    console.error("Invalid timestamp format:", isoString);
    return "Invalid date";
  }
}

// Memory: Fetch and display memories
async function fetchMemories() {
  if (!DOM.memoriesList || !userEmail) return;

  DOM.memoriesList.innerHTML = "";

  try {
    const res = await fetch(`${FIRESTORE_BASE_URL}/memories/${userEmail}`);
    if (!res.ok) throw new Error("Failed to fetch memories");

    const data = await res.json();
    memoryEntries = Object.values(
      data.fields?.memories?.mapValue?.fields || {}
    );

    //sort in chronological order
    memoryEntries.sort((a, b) => {
      const timeA = new Date(a.mapValue.fields.timestamp.stringValue);
      const timeB = new Date(b.mapValue.fields.timestamp.stringValue);
      return timeB - timeA; // Newest first
    });

   memoryEntries.forEach((entry) => {
  const { title, notes, location, mediaUrl, tags, timestamp } = entry.mapValue.fields;
  const isVideo = /\.(mp4|webm|ogg)$/i.test(mediaUrl.stringValue);

  const rawTimestamp = entry.mapValue.fields.timestamp?.stringValue;
  const formattedTime = formatTimestamp(rawTimestamp);

  const encodedUrl = encodeURIComponent(mediaUrl.stringValue);

  const card = `
    <div class="col" style="margin-bottom: 20px;">
      <div class="memory-card shadow-sm rounded-4 overflow-hidden">
        <div class="media-section">
          ${
            isVideo
              ? `<video controls><source src="${mediaUrl.stringValue}" type="video/mp4"></video>`
              : `<img src="${mediaUrl.stringValue}" alt="Memory Media">`
          }
        </div>
        <div class="memory-content p-3">
          <div class="timestamp text-muted small mb-2">
            <i class="fa-regular fa-clock"></i> ${formattedTime}
          </div>
          <h3 class="fs-5"><i class="fa-solid fa-bookmark"></i> ${title.stringValue}</h3>
          <p class="small"><i class="fa-solid fa-pen-nib"></i> ${notes.stringValue}</p>
          <div class="tags text-primary mb-2">
            ${
              tags?.arrayValue?.values
                ?.map((t) => `<span class="me-1">#${t.stringValue}</span>`)
                .join("") || ""
            }
          </div>
          <div class="location text-muted mb-3">
            <i class="fa-solid fa-location-dot"></i> ${
              location?.stringValue || "Unknown location"
            }
          </div>
          <div class="d-flex justify-content-between align-items-center border-top pt-2 share-icons">
            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" title="Share on Facebook">
              <i class="fa-brands fa-facebook fa-lg text-primary"></i>
            </a>
            <a href="https://api.whatsapp.com/send?text=${encodedUrl}" target="_blank" title="Share on WhatsApp">
              <i class="fa-brands fa-whatsapp fa-lg text-success"></i>
            </a>
            <a href="https://www.instagram.com/" target="_blank" title="Open Instagram">
              <i class="fa-brands fa-instagram fa-lg text-danger"></i>
            </a>
            <a href="https://twitter.com/intent/tweet?url=${encodedUrl}" target="_blank" title="Tweet This">
              <i class="fa-brands fa-x-twitter fa-lg text-dark"></i>
            </a>
            <a href="${mediaUrl.stringValue}" download="${title.stringValue || 'memory'}" target="_blank" title="Download">
              <i class="fa-solid fa-download fa-lg text-secondary"></i>
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  DOM.memoriesList.insertAdjacentHTML("beforeend", card);
});

  } catch (error) {
    console.error("Error fetching memories:", error);
    DOM.memoriesList.innerHTML = `<p class="text-center">Failed to load memories.</p>`;
  }
}

// Memory: Search memories
// Memory: Search memories
function searchMemories(query) {
  if (!DOM.memoriesList) return;

  DOM.memoriesList.innerHTML = "";
  const q = query.toLowerCase().trim();

  if (!q) {
    fetchMemories(); // Re-display all memories if query is empty
    return;
  }

  const filteredEntries = memoryEntries.filter((entry) => {
    const { title, notes, location, tags, timestamp } = entry.mapValue.fields;
    return (
      (title?.stringValue || "").toLowerCase().includes(q) ||
      (notes?.stringValue || "").toLowerCase().includes(q) ||
      (location?.stringValue || "").toLowerCase().includes(q) ||
      (tags?.arrayValue?.values || []).some((t) =>
        (t.stringValue || "").toLowerCase().includes(q)
      ) ||
      formatTimestamp(timestamp?.stringValue || "").toLowerCase().includes(q)
    );
  });

  if (!filteredEntries.length) {
    DOM.memoriesList.innerHTML = `<p class="text-center text-muted">No results found for "${q}".</p>`;
    return;
  }

  filteredEntries.forEach((entry) => {
    const { title, notes, location, mediaUrl, tags, timestamp } = entry.mapValue.fields;
    const isVideo = /\.(mp4|webm|ogg)$/i.test(mediaUrl.stringValue);
    const formattedTime = formatTimestamp(timestamp?.stringValue);
    const encodedUrl = encodeURIComponent(mediaUrl.stringValue);

    const card = `
      <div class="col" style="margin-bottom: 20px;">
        <div class="memory-card shadow-sm rounded-4 overflow-hidden">
          <div class="media-section">
            ${
              isVideo
                ? `<video controls><source src="${mediaUrl.stringValue}" type="video/mp4"></video>`
                : `<img src="${mediaUrl.stringValue}" alt="Memory Media">`
            }
          </div>
          <div class="memory-content p-3">
            <div class="timestamp text-muted small mb-2">
              <i class="fa-regular fa-clock"></i> ${formattedTime}
            </div>
            <h3 class="fs-5"><i class="fa-solid fa-bookmark"></i> ${title.stringValue}</h3>
            <p class="small"><i class="fa-solid fa-pen-nib"></i> ${notes.stringValue}</p>
            <div class="tags text-primary mb-2">
              ${
                tags?.arrayValue?.values
                  ?.map((t) => `<span class="me-1">#${t.stringValue}</span>`)
                  .join("") || ""
              }
            </div>
            <div class="location text-muted mb-3">
              <i class="fa-solid fa-location-dot"></i> ${
                location?.stringValue || "Unknown location"
              }
            </div>
            <div class="d-flex justify-content-between align-items-center border-top pt-2 share-icons">
              <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" title="Share on Facebook">
                <i class="fa-brands fa-facebook fa-lg text-primary"></i>
              </a>
              <a href="https://api.whatsapp.com/send?text=${encodedUrl}" target="_blank" title="Share on WhatsApp">
                <i class="fa-brands fa-whatsapp fa-lg text-success"></i>
              </a>
              <a href="https://www.instagram.com/" target="_blank" title="Open Instagram">
                <i class="fa-brands fa-instagram fa-lg text-danger"></i>
              </a>
              <a href="https://twitter.com/intent/tweet?url=${encodedUrl}" target="_blank" title="Tweet This">
                <i class="fa-brands fa-x-twitter fa-lg text-dark"></i>
              </a>
              <a href="${mediaUrl.stringValue}" download="${title.stringValue || 'memory'}" target="_blank" title="Download">
                <i class="fa-solid fa-download fa-lg text-secondary"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
    DOM.memoriesList.insertAdjacentHTML("beforeend", card);
  });
}

// Voice Notes: Initialize recording
function initVoiceRecording() {
  if (
    !DOM.startRecordingBtn ||
    !DOM.stopRecordingBtn ||
    !DOM.recordingStatus ||
    !DOM.voiceNotePreview ||
    !DOM.saveVoiceNoteBtn
  )
    return;

  DOM.startRecordingBtn.addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Your browser does not support audio recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        DOM.voiceNotePreview.src = URL.createObjectURL(audioBlob);
        DOM.voiceNotePreview.classList.remove("d-none");
        DOM.saveVoiceNoteBtn.disabled = false;
      };

      mediaRecorder.start();
      DOM.startRecordingBtn.classList.add("d-none");
      DOM.stopRecordingBtn.classList.remove("d-none");
      DOM.recordingStatus.style.display = "block";
    } catch (error) {
      alert(`Microphone access denied: ${error.message}`);
    }
  });

  DOM.stopRecordingBtn.addEventListener("click", () => {
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.stop();
      DOM.startRecordingBtn.classList.remove("d-none");
      DOM.stopRecordingBtn.classList.add("d-none");
      DOM.recordingStatus.style.display = "none";
    }
  });

  DOM.saveVoiceNoteBtn.addEventListener("click", async () => {
    const title = DOM.voiceNoteTitle?.value.trim();
    if (!title) {
      alert("Please enter a title for the voice note.");
      return;
    }
    if (!audioChunks.length) {
      alert("No audio recorded.");
      return;
    }
    if (!userEmail) {
      alert("User not logged in.");
      return;
    }

    try {
      toggleLoader(true);
      DOM.saveVoiceNoteBtn.disabled = true;

      // Upload to Cloudinary
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", audioBlob, "voiceNote.webm");
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      const cloudRes = await fetch(`${CLOUDINARY_BASE_URL}/video/upload`, {
        method: "POST",
        body: formData,
      });
      const cloudData = await cloudRes.json();
      if (!cloudData.secure_url) throw new Error("Cloudinary upload failed");
      const audioUrl = cloudData.secure_url;

      // Save to Firestore
      const docUrl = `${FIRESTORE_BASE_URL}/voicenotes/${userEmail}`;
      const getRes = await fetch(docUrl);
      const existingNotes = getRes.ok
        ? (await getRes.json()).fields?.notes?.mapValue?.fields || {}
        : {};

      const noteKey = `note_${Date.now()}`;
      const noteFields = {
        title: { stringValue: title },
        audioUrl: { stringValue: audioUrl },
        timestamp: { stringValue: new Date().toISOString() },
      };

      const updatedNotes = {
        ...existingNotes,
        [noteKey]: { mapValue: { fields: noteFields } },
      };
      const body = {
        fields: { notes: { mapValue: { fields: updatedNotes } } },
      };

      const patchRes = await fetch(`${docUrl}?currentDocument.exists=true`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!patchRes.ok) {
        const createRes = await fetch(docUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!createRes.ok) throw new Error("Failed to save voice note");
      }

      DOM.voiceNotePreview.src = "";
      DOM.voiceNotePreview.classList.add("d-none");
      DOM.voiceNoteTitle.value = "";
      audioChunks = [];
      DOM.saveVoiceNoteBtn.disabled = true;

      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addVoiceNoteModal")
      );
      modal?.hide();
      await fetchVoiceNotes();
    } catch (error) {
      alert(`Failed to save voice note: ${error.message}`);
      DOM.saveVoiceNoteBtn.disabled = false;
    } finally {
      toggleLoader(false);
    }
  });
}

// Voice Notes: Fetch and display
async function fetchVoiceNotes() {
  if (!DOM.voiceNotesList || !userEmail) return;

  const addBtnHTML = DOM.addVoiceNoteBtn?.parentElement?.outerHTML || "";
  DOM.voiceNotesList.innerHTML = addBtnHTML;

  try {
    const res = await fetch(`${FIRESTORE_BASE_URL}/voicenotes/${userEmail}`);
    if (!res.ok) throw new Error("No voice notes found");

    const data = await res.json();
    const notesArr = Object.values(data.fields?.notes?.mapValue?.fields || {});

    if (!notesArr.length) {
      DOM.voiceNotesList.innerHTML += `
        <div class="col">
          <div class="alert alert-info text-center w-100">No voice notes found.</div>
        </div>`;
      return;
    }

    notesArr
      .sort(
        (a, b) =>
          new Date(b.mapValue.fields.timestamp.stringValue) -
          new Date(a.mapValue.fields.timestamp.stringValue)
      )
      .forEach(({ mapValue: { fields } }) => {
        const card = `
          <div class="col" style="margin-bottom: 20px;">
            <div class="card shadow-sm rounded-4 h-100 p-3 d-flex flex-column justify-content-between">
              <div class="d-flex align-items-center gap-2 mb-2">
                <img src="./assets/mic.png" width="32" />
                <h5 class="mb-0">${fields.title?.stringValue || "Untitled"}</h5>
              </div>
              <audio controls src="${
                fields.audioUrl?.stringValue
              }" class="w-100 my-2"></audio>
              <small class="text-muted">${new Date(
                fields.timestamp?.stringValue
              ).toLocaleString()}</small>

              
              
            
            
          </div>
        `;
        DOM.voiceNotesList.insertAdjacentHTML("beforeend", card);
      });
  } catch (error) {
    console.error("Error loading voice notes:", error);
    DOM.voiceNotesList.innerHTML += `
      <div class="col">
        <div class="alert alert-danger text-center w-100">Failed to load voice notes.</div>
      </div>`;
  }
}

// UI: Theme toggle
function initThemeToggle() {
  DOM.themeToggle?.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    const icon = DOM.themeToggle.querySelector("i");
    icon.classList.toggle("fa-moon", !isDark);
    icon.classList.toggle("fa-sun", isDark);
    sessionStorage.setItem("theme", isDark ? "dark" : "light");
  });

  if (sessionStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    DOM.themeToggle.querySelector("i")?.classList.replace("fa-moon", "fa-sun");
  }
}

// UI: Show section (timeline, voicenotes, albums)
function showSection(section) {
  const containers = {
    timeline: document.querySelector(".timeline-container"),
    voicenotes: document.querySelector(".voiceNotes-container"),
    albums: document.querySelector(".albums-container"),
  };
  const buttons = {
    timeline: document.querySelectorAll('a[href="timeline.html"]'),
    voicenotes: document.querySelectorAll('a[href="voicenotes.html"]'),
    albums: document.querySelectorAll('a[href="albums.html"]'),
  };

  Object.values(containers).forEach((c) => c && (c.hidden = true));
  Object.values(buttons).forEach((btns) =>
    btns.forEach((b) => b.classList.remove("active"))
  );

  containers[section] && (containers[section].hidden = false);
  buttons[section].forEach((b) => b.classList.add("active"));

  const sidebar = document.querySelector(".sidebar.offcanvas");
  if (sidebar && bootstrap?.Offcanvas) {
    const sidebarInstance = bootstrap.Offcanvas.getInstance(sidebar);
    sidebarInstance?.hide();
  }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", async () => {
  toggleLoader(true);
  redirectUnauthorized();

  initThemeToggle();
  await fetchMemories();
  await fetchVoiceNotes();
  initVoiceRecording();

  DOM.memoryForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await uploadMemory();
  });

  DOM.searchInput?.addEventListener("input", (e) =>
    searchMemories(e.target.value)
  );

  DOM.addVoiceNoteBtn?.addEventListener("click", () => {
    const modal = new bootstrap.Modal(
      document.getElementById("addVoiceNoteModal")
    );
    modal.show();
  });

  const navLinks = [
    { selector: 'a[href="timeline.html"]', section: "timeline" },
    { selector: 'a[href="voicenotes.html"]', section: "voicenotes" },
    { selector: 'a[href="albums.html"]', section: "albums" },
  ];

  navLinks.forEach(({ selector, section }) => {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        showSection(section);
      });
    });
  });

  toggleLoader(false);
});
