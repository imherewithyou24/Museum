import { saveData } from './firebase.js';

// ==========================================================
// FUNGSI NOTIFIKASI KECIL (TOAST)
// ==========================================================
export function showToast(message, duration = 1500) {
  const toast = document.getElementById('toast');
  if(!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

// ==========================================================
// INISIALISASI MODE ADMIN
// ==========================================================
export function initAdminMode() {
  console.log("🔥 Admin Mode Aktif!");
  document.body.classList.add('admin-mode');
  
  // 1. INLINE EDITING UNTUK SEMUA TEKS
  document.body.addEventListener('click', (e) => {
    const target = e.target.closest('[data-editable]');
    if (!target) return;
    
    e.preventDefault(); // Cegah fungsi asli (misal kalau tombol Replay diklik)
    if (target.isEditing) return;

    // Mulai Mode Edit
    target.isEditing = true;
    target.contentEditable = "true";
    target.focus();

    // Pindahkan kursor otomatis ke ujung kanan teks
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const originalText = target.innerText;

    // Fungsi Save Teks
    const finishEdit = async (save) => {
      target.isEditing = false;
      target.contentEditable = "false";
      target.removeEventListener('keydown', keydownHandler);
      target.removeEventListener('blur', blurHandler);

      const newText = target.innerText.trim();
      const key = target.dataset.editable;

      if (save && newText !== originalText) {
        showToast("Saving...");
        try {
          await saveData(key, newText);
          showToast("✓ Saved");
        } catch (err) {
          showToast("Gagal menyimpan!");
          console.error("Firebase error:", err);
        }
      } else if (!save) {
        target.innerText = originalText; // Batal edit, kembalikan teks asli
      }
    };

    // Deteksi tombol Keyboard (Enter = Save, Escape = Batal)
    const keydownHandler = (evt) => {
      if (evt.key === 'Escape') finishEdit(false);
      if (evt.key === 'Enter' && !evt.shiftKey) {
        evt.preventDefault();
        finishEdit(true); 
      }
    };

    // Jika admin mengklik sembarang tempat di luar teks, otomatis tersimpan
    const blurHandler = () => finishEdit(true);

    target.addEventListener('keydown', keydownHandler);
    target.addEventListener('blur', blurHandler);
  });

  // ==========================================================
  // 2. GANTI LINK FOTO MENGGUNAKAN POPUP
  // ==========================================================
  const images = document.querySelectorAll('img[data-img]');
  const popup = document.getElementById('imagePopup');
  const urlInput = document.getElementById('imgUrlInput');
  const btnCancel = document.getElementById('btnCancelImg');
  const btnSave = document.getElementById('btnSaveImg');
  
  let currentImgKey = null;
  let currentImgEl = null;

  // Pasang fitur klik pada semua foto di galeri
  images.forEach(img => {
    img.addEventListener('click', () => {
      currentImgKey = img.dataset.img;
      currentImgEl = img;
      urlInput.value = img.src; // Isi input dengan link foto saat ini
      popup.classList.remove('hidden');
      urlInput.focus();
    });
  });

  // Tombol Batal
  btnCancel.addEventListener('click', () => popup.classList.add('hidden'));

  // Tombol Simpan
  btnSave.addEventListener('click', async () => {
    const newUrl = urlInput.value.trim();
    if (newUrl) {
      popup.classList.add('hidden');
      showToast("Saving image...");
      currentImgEl.src = newUrl; // Ganti gambar langsung di layar admin (biar cepat)
      try {
        await saveData(currentImgKey, newUrl);
        showToast("✓ Image Saved");
      } catch(err) {
        showToast("Gagal menyimpan!");
        console.error("Firebase error:", err);
      }
    }
  });
}
