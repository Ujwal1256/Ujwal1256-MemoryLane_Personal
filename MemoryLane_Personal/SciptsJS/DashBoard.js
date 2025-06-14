


function toggleLoader(show = true) {
  let loader = document.querySelector("#loader-modal");
  if (show) loader?.classList.add("show");
  else loader?.classList.remove("show");
}
// Get the user email from sessionStorage
const user = JSON.parse(sessionStorage.getItem("user"));
const userEmail = user?.email;

// Cloudinary preset
const CLOUDINARY_UPLOAD_PRESET = "memories";

// Logout functionality
async function LogOut() {
  try {
    sessionStorage.clear();
    localStorage.setItem("logged in", "false");
    // Use replace to prevent back navigation to dashboard
    window.location.replace("index.html");
  } catch (error) {
    console.error("Logout failed:", error);
  }
}

// Redirect unauthorized users
if (!user) {
  if (localStorage.getItem("logged in") === "false") {
    localStorage.removeItem("logged in");
    window.location.replace("index.html");
  }
}



// Handle form submission
document.getElementById("memoryForm").addEventListener("submit", async function (event) {
  event.preventDefault();

  try {
    
     uploadMemory(); // upload memory to Firebase or wherever
     document.getElementById("memoryForm").reset();
    

      // const modal = bootstrap.Modal.getInstance(
      //   document.getElementById("addMemoryCard")
      // );
      // if (modal) modal.hide();
    // Reset the form
   

    //  reload memory list
    //  fetchMemories();
  } catch (error) {
    console.error("Error uploading memory:", error);
    alert("Failed to add memory. Please try again.");
  }
});



// Upload and store memory
// Revised uploadMemory() to merge new memory with existing memories map
async function uploadMemory() {
  const title = document.getElementById("title").value;
  const notes = document.getElementById("notes").value;
  const tags = document.getElementById("tags").value;
  const location = document.getElementById("location").value;
  const mediaFile = document.getElementById("media").files[0];
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("addMemoryModal")
  );

  if (!mediaFile || !userEmail) {
    alert("Missing media or user session.");
    return;
  }

  const formData = new FormData();
  formData.append("file", mediaFile);
  const isVideo = mediaFile.type.startsWith("video/");
  const CLOUDINARY_URL = isVideo
    ? "https://api.cloudinary.com/v1_1/dwt3fmnmm/video/upload"
    : "https://api.cloudinary.com/v1_1/dwt3fmnmm/image/upload";

  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  try {
    toggleLoader(true);
    const cloudRes = await fetch(CLOUDINARY_URL, {
      method: "POST",
      body: formData,
    });

    const cloudData = await cloudRes.json();
    const mediaUrl = cloudData.secure_url;

    const memoryKey = `memory_${Date.now()}`;
    const memoryFields = {
      title: { stringValue: title },
      notes: { stringValue: notes },
      location: { stringValue: location },
      mediaUrl: { stringValue: mediaUrl },
      timestamp: { stringValue: new Date().toISOString() },
      tags: {
        arrayValue: {
          values: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => ({ stringValue: t })),
        },
      },
    };

    const docUrl = `https://firestore.googleapis.com/v1/projects/samdb-66322/databases/(default)/documents/memories/${userEmail}`;

    // 1. Get existing document
    const getRes = await fetch(docUrl);
    const docData = await getRes.json();
    const existingMemories = docData.fields?.memories?.mapValue?.fields || {};

    // 2. Append new memory to existing map
    const updatedMemories = {
      ...existingMemories,
      [memoryKey]: { mapValue: { fields: memoryFields } },
    };

    // 3. Patch with merged data
    const body = {
      fields: {
        memories: {
          mapValue: {
            fields: updatedMemories,
          },
        },
      },
    };

    const res = await fetch(`${docUrl}?currentDocument.exists=true`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      toggleLoader(false);
      throw new Error("Failed to store memory");
      
    }

    if (modal) modal.hide();
    fetchMemories();
    toggleLoader(false);
  } catch (err) {
    if (modal) modal.hide();
    toggleLoader(false);
    console.error("Upload failed:", err);
  }
}

// Fetch and display memories

let memoryEntries = {};
const memoryContainer = document.getElementById("memories-list");

function searchMemories(query) {
  memoryContainer.innerHTML = "";

  const filteredEntries = memoryEntries.filter((entry) => {
    const fields = entry.mapValue.fields;
    const title = fields.title?.stringValue?.toLowerCase() || "";
    const notes = fields.notes?.stringValue?.toLowerCase() || "";
    const location = fields.location?.stringValue?.toLowerCase() || "";
    const tags =
      fields.tags?.arrayValue?.values?.map((t) =>
        t.stringValue.toLowerCase()
      ) || [];

    const q = query.toLowerCase();

    return (
      title.includes(q) ||
      notes.includes(q) ||
      location.includes(q) ||
      tags.some((tag) => tag.includes(q))
    );
  });

  if (filteredEntries.length === 0) {
    memoryContainer.innerHTML = `<p style="text-align:center">No results found.</p>`;
    return;
  }

  filteredEntries.forEach((entry) => {
    const memoryData = entry.mapValue.fields;
    const mediaUrl = memoryData.mediaUrl.stringValue;
    const isVideo = /\.(mp4|webm|ogg)$/i.test(mediaUrl);

    const card = `
      <div class="col">
        <div class="memory-card">
          <div class="media-section">
            ${
              isVideo
                ? `<video controls>
                    <source src="${mediaUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                  </video>`
                : `<img src="${mediaUrl}" alt="Memory Media">`
            }
          </div>
          <div class="memory-content">
            <h3><i class="fa-solid fa-bookmark"></i> ${
              memoryData.title.stringValue
            }</h3>
            <p><i class="fa-solid fa-pen-nib"></i> ${
              memoryData.notes.stringValue
            }</p>
            <div class="tags">
              ${
                memoryData.tags?.arrayValue?.values
                  ?.map((t) => `<span>#${t.stringValue}</span>`)
                  .join("") || ""
              }
            </div>
            <div class="location">
              <i class="fa-solid fa-location-dot"></i>
              ${memoryData.location?.stringValue || "Unknown location"}
            </div>
          </div>
        </div>
      </div>
    `;

    memoryContainer.innerHTML += card;
  });
}



async function fetchMemories() {
  const memoryContainer = document.getElementById("memories-list");

  if (!memoryContainer ) return;

  // Reset but preserve the Add Button
  memoryContainer.innerHTML = "";

  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/samdb-66322/databases/(default)/documents/memories/${userEmail}`
    );

    if (!res.ok) throw new Error("Fetch failed");

    const data = await res.json();
    const memoriesMap = data.fields?.memories?.mapValue?.fields || {};
    memoryEntries = Object.values(memoriesMap);

    memoryEntries.forEach((entry) => {
      const memoryData = entry.mapValue.fields;
      const mediaUrl = memoryData.mediaUrl.stringValue;
      const isVideo = /\.(mp4|webm|ogg)$/i.test(mediaUrl);

      const card = `
        <div class="col">
          <div class="memory-card shadow-sm rounded-4 overflow-hidden">
            <div class="media-section">
              ${
                isVideo
                  ? `<video controls><source src="${mediaUrl}" type="video/mp4"></video>`
                  : `<img src="${mediaUrl}" alt="Memory Media">`
              }
            </div>
            <div class="memory-content p-3">
              <h3 class="fs-5"><i class="fa-solid fa-bookmark"></i> ${memoryData.title.stringValue}</h3>
              <p class="small"><i class="fa-solid fa-pen-nib"></i> ${memoryData.notes.stringValue}</p>
              <div class="tags text-primary mb-2">
                ${
                  memoryData.tags?.arrayValue?.values
                    ?.map((t) => `<span class="me-1">#${t.stringValue}</span>`)
                    .join("") || ""
                }
              </div>
              <div class="location text-muted">
                <i class="fa-solid fa-location-dot"></i> ${memoryData.location?.stringValue || "Unknown location"}
              </div>
            </div>
          </div>
        </div>
      `;

      memoryContainer.insertAdjacentHTML("beforeend", card);
    });
  } catch (error) {
    console.error("Error fetching memories:", error);
  }
}


// voice notes implemntation

document
  .getElementById("add-voice-note-btn")
  .addEventListener("click", function () {
    var addVoiceNoteModal = new bootstrap.Modal(
      document.getElementById("addVoiceNoteModal")
    );
    addVoiceNoteModal.show();
  });

// Voice recording logic
let mediaRecorder;
let audioChunks = [];

const startBtn = document.getElementById("startRecordingBtn");
const stopBtn = document.getElementById("stopRecordingBtn");
const statusDiv = document.getElementById("recordingStatus");
const audioPreview = document.getElementById("voiceNotePreview");
const saveBtn = document.getElementById("saveVoiceNoteBtn");
const voiceNoteTitleInput = document.getElementById("voiceNoteTitle");

if (startBtn && stopBtn && statusDiv && audioPreview && saveBtn) {
  startBtn.addEventListener("click", async function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Your browser does not support audio recording.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPreview.src = audioUrl;
        audioPreview.classList.remove("d-none");
        saveBtn.disabled = false;
      };

      mediaRecorder.start();
      startBtn.classList.add("d-none");
      stopBtn.classList.remove("d-none");
      statusDiv.style.display = "block";
    } catch (err) {
      alert("Microphone access denied or error: " + err.message);
    }
  });

  stopBtn.addEventListener("click", function () {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
    startBtn.classList.remove("d-none");
    stopBtn.classList.add("d-none");
    statusDiv.style.display = "none";
  });

  saveBtn.addEventListener("click", async function () {
    saveBtn.disabled = true;
    
    const title = voiceNoteTitleInput ? voiceNoteTitleInput.value.trim() : "";
    if (!title) {
      alert("Please enter a title for the voice note.");
      saveBtn.disabled = false;
      return;
    }
    if (!audioChunks.length) {
      alert("No audio recorded.");
      saveBtn.disabled = false;
      return;
    }
    if (!userEmail) {
      alert("User not logged in.");
      saveBtn.disabled = false;
      return;
    }

    // Upload audio to Cloudinary
    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
    const formData = new FormData();
    formData.append("file", audioBlob, "voiceNote.webm");
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    try {
      toggleLoader(true);
      const cloudRes = await fetch(
        "https://api.cloudinary.com/v1_1/dwt3fmnmm/video/upload",
        {
          method: "POST",
          body: formData,
        }
      );
      const cloudData = await cloudRes.json();
      const audioUrl = cloudData.secure_url;
      if (!audioUrl) throw new Error("Cloudinary upload failed");

      // Prepare Firestore document
      const docUrl = `https://firestore.googleapis.com/v1/projects/samdb-66322/databases/(default)/documents/voicenotes/${userEmail}`;

      // 1. Get existing document
      let existingNotes = {};
      const getRes = await fetch(docUrl);
      if (getRes.ok) {
        const docData = await getRes.json();
        existingNotes = docData.fields?.notes?.mapValue?.fields || {};
      }

      // 2. Append new note to map
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

      // 3. Patch with merged data (or create if not exists)
      const body = {
        fields: {
          notes: {
            mapValue: {
              fields: updatedNotes,
            },
          },
        },
      };

      const patchRes = await fetch(`${docUrl}?currentDocument.exists=true`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!patchRes.ok) {
        // If doc doesn't exist, create it
        const createRes = await fetch(docUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!createRes.ok) throw new Error("Failed to save voice note");
      }

      // Reset UI
      audioPreview.src = "";
      audioPreview.classList.add("d-none");
      if (voiceNoteTitleInput) voiceNoteTitleInput.value = "";
      audioChunks = [];
      saveBtn.disabled = true;

      // Hide modal
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("addVoiceNoteModal")
      );
      if (modal) modal.hide();

      // Fetch and display updated voice notes
      fetchVoiceNotes();
      toggleLoader(false);
    } catch (err) {
      alert("Failed to save voice note: " + err.message);
      saveBtn.disabled = false;
      toggleLoader(false);
    }
  });
}

// Fetch and display voice notes
async function fetchVoiceNotes() {
  const container = document.getElementById("voiceNotesList");
  if (!container) return;
  if (!userEmail) return;

  // 🔁 Preserve the Add Voice Note button (if it exists)
  const addBtnHTML =
    container.querySelector("#add-voice-note-btn")?.parentElement?.outerHTML ||
    "";

  // Clear the container and re-insert the Add Button
  container.innerHTML = addBtnHTML;

  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/samdb-66322/databases/(default)/documents/voicenotes/${userEmail}`
    );

    console.log("Fetch response:", res);

    if (!res.ok) {
      container.innerHTML += `
        <div class="col">
          <div class="alert alert-info text-center w-100">No voice notes found.</div>
        </div>`;
      return;
    }

    const data = await res.json();
    console.log("Fetched voice notes data:", data);

    const notesMap = data.fields?.notes?.mapValue?.fields || {};
    const notesArr = Object.values(notesMap);

    if (!notesArr.length) {
      container.innerHTML += `
        <div class="col">
          <div class="alert alert-info text-center w-100">No voice notes found.</div>
        </div>`;
      return;
    }

    notesArr
      .sort((a, b) => {
        const ta = a.mapValue.fields.timestamp.stringValue;
        const tb = b.mapValue.fields.timestamp.stringValue;
        return new Date(tb) - new Date(ta);
      })
      .forEach((entry) => {
        const fields = entry.mapValue.fields;
        const title = fields.title?.stringValue || "Untitled";
        const audioUrl = fields.audioUrl?.stringValue || "";
        const timestamp = fields.timestamp?.stringValue || "";

        const card = `
          <div class="col">
            <div class="card shadow-sm rounded-4 h-100 p-3 d-flex flex-column justify-content-between">
              <div class="d-flex align-items-center gap-2 mb-2">
                <img src="./assets/mic.png" width="32" />
                <h5 class="mb-0">${title}</h5>
              </div>
              <audio controls src="${audioUrl}" class="w-100 my-2"></audio>
              <small class="text-muted">${new Date(
                timestamp
              ).toLocaleString()}</small>
            </div>
          </div>
        `;

        container.insertAdjacentHTML("beforeend", card);
      });
  } catch (err) {
    console.error("Error loading voice notes:", err);
    container.innerHTML += `
      <div class="col">
        <div class="alert alert-danger text-center w-100">Failed to load voice notes.</div>
      </div>`;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  toggleLoader(true);
  fetchMemories();
  fetchVoiceNotes();
  toggleLoader(false);
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchMemories(e.target.value);
    });
  }

  const toggleBtn = document.getElementById("themeToggle");

  toggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");

    const icon = toggleBtn.querySelector("i");
    const isDark = document.body.classList.contains("dark-mode");

    icon.classList.toggle("fa-moon", !isDark);
    icon.classList.toggle("fa-sun", isDark);

    localStorage.setItem("theme", isDark ? "dark" : "light");
  });

  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    toggleBtn.querySelector("i").classList.replace("fa-moon", "fa-sun");
  }
  // Use a switch statement to show the correct section based on the clicked link
  function showSection(section) {
    // Remove "active" from all nav links
    document.querySelectorAll(".sidebar a, .navbar-nav a").forEach((link) => {
      link.classList.remove("active");
    });

    switch (section) {
      case "timeline":
        if (timelineContainer) timelineContainer.hidden = false;
        if (voiceNotesContainer) voiceNotesContainer.hidden = true;
        if (albumsContainer) albumsContainer.hidden = true;
        // Set only timeline tab active
        timelineBtn.forEach((btn) => btn.classList.add("active"));
        voiceNotesBtn.forEach((btn) => btn.classList.remove("active"));
        albumsBtn.forEach((btn) => btn.classList.remove("active"));
        break;
      case "voicenotes":
        if (timelineContainer) timelineContainer.hidden = true;
        if (voiceNotesContainer) voiceNotesContainer.hidden = false;
        if (albumsContainer) albumsContainer.hidden = true;
        // Set only voicenotes tab active
        timelineBtn.forEach((btn) => btn.classList.remove("active"));
        voiceNotesBtn.forEach((btn) => btn.classList.add("active"));
        albumsBtn.forEach((btn) => btn.classList.remove("active"));
        break;
      case "albums":
        if (timelineContainer) timelineContainer.hidden = true;
        if (voiceNotesContainer) voiceNotesContainer.hidden = true;
        if (albumsContainer) albumsContainer.hidden = false;
        // Set only albums tab active
        timelineBtn.forEach((btn) => btn.classList.remove("active"));
        voiceNotesBtn.forEach((btn) => btn.classList.remove("active"));
        albumsBtn.forEach((btn) => btn.classList.add("active"));
        break;
    }

    // Close sidebar if open (Bootstrap 5 Offcanvas)
    const sidebar = document.querySelector(".sidebar.offcanvas");
    if (sidebar && bootstrap && bootstrap.Offcanvas.getInstance) {
      const sidebarInstance = bootstrap.Offcanvas.getInstance(sidebar);
      if (sidebarInstance) sidebarInstance.hide();
    }
  }

  const voiceNotesBtn = document.querySelectorAll('a[href="voicenotes.html"]');
  const timelineBtn = document.querySelectorAll('a[href="timeline.html"]');
  const albumsBtn = document.querySelectorAll('a[href="albums.html"]');
  const timelineContainer = document.querySelector(".timeline-container");
  const voiceNotesContainer = document.querySelector(".voiceNotes-container");
  const albumsContainer = document.querySelector(".albums-containner");

  voiceNotesBtn.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      showSection("voicenotes");
    });
  });
  timelineBtn.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      showSection("timeline");
    });
  });
  albumsBtn.forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      showSection("albums");
    });
  });

  // // On page load, show timeline by default
  // showSection("timeline");
});
