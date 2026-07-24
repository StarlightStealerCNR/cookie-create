// ── Image preview on upload ──
const imageInput = document.getElementById("image-input");
const uploadPreview = document.getElementById("upload-preview");
const uploadPlaceholder = document.getElementById("upload-placeholder");

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  uploadPreview.src = url;
  uploadPreview.classList.add("visible");
  uploadPlaceholder.style.display = "none";
});

// ── Form references ──
const generateBtn = document.getElementById("generate-btn");
const errorMsg = document.getElementById("error-msg");
const promptInput = document.getElementById("prompt");
const modeSelect = document.getElementById("mode");
const countInput = document.getElementById("count");

// ── Helpers ──
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.removeAttribute("hidden");
}

function clearError() {
  errorMsg.textContent = "";
  errorMsg.setAttribute("hidden", "");
}

// ── Output grid ──
const outputGrid = document.getElementById("output-grid");

// ── Generate button — validation + fetch ──
generateBtn.addEventListener("click", async () => {
  clearError();

  const file = imageInput.files[0];
  const prompt = promptInput.value.trim();

  // Guard: image required
  if (!file) {
    showError("Please upload a reference image before generating.");
    return;
  }

  // Guard: description required
  if (!prompt) {
    showError("Please enter a design description before generating.");
    return;
  }

  // ── Loading state ──
  generateBtn.disabled = true;
  generateBtn.classList.add("loading");
  generateBtn.textContent = "Generating";

  try {
    // ── Build request ──
    const formData = new FormData();
    formData.append("image", file);
    formData.append("prompt", prompt);
    formData.append("mode", modeSelect.value);
    formData.append("count", countInput.value);

    // ── Send to serverless function ──
    const response = await fetch("/api/generate", {
      method: "POST",
      body: formData,
      // Do NOT set Content-Type — browser sets multipart boundary automatically
    });

    // ── Handle rate limit ──
    if (response.status === 429) {
      const data = await response.json();
      showError(data.error || "Too many requests — please wait a few minutes.");
      return;
    }

    // ── Handle other errors ──
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      showError(
        data.error ||
          `Something went wrong (${response.status}). Please try again.`,
      );
      return;
    }

    // ── Display results ──
    const { images } = await response.json();

    // Clear previous results
    outputGrid.innerHTML = "";

    images.forEach((base64) => {
      const img = document.createElement("img");
      img.src = `data:image/png;base64,${base64}`;
      img.alt = "Generated cookie design";
      outputGrid.appendChild(img);
    });
  } catch (err) {
    showError(
      "A network error occurred. Please check your connection and try again.",
    );
  } finally {
    // ── Always restore button ──
    generateBtn.disabled = false;
    generateBtn.classList.remove("loading");
    generateBtn.textContent = "Generate";
  }
});
