// ── Image preview on upload ──
const imageInput    = document.getElementById('image-input');
const uploadPreview = document.getElementById('upload-preview');
const uploadPlaceholder = document.getElementById('upload-placeholder');

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  uploadPreview.src = url;
  uploadPreview.classList.add('visible');
  uploadPlaceholder.style.display = 'none';
});

// Sub-Tasks 4 & 5 will add form validation and the fetch call here.
