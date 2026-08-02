import { saveData } from './firebase.js';

export function showToast(message, duration = 1500) {
  const toast = document.getElementById('toast');
  if(!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

export function initAdminMode() {
  console.log("🔥 Admin Mode Aktif!");
  document.body.classList.add('admin-mode');
  
  // 1. INLINE TEXT EDITING
  document.body.addEventListener('click', (e) => {
    const target = e.target.closest('[data-editable]');
    if (!target) return;
    
    e.preventDefault(); 
    if (target.isEditing) return;

    target.isEditing = true;
    target.contentEditable = "true";
    target.focus();

    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const originalText = target.innerText;

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
          showToast("Saved ✓");
        } catch (err) {
          showToast("Gagal menyimpan!");
        }
      } else if (!save) {
        target.innerText = originalText;
      }
    };

    const keydownHandler = (evt) => {
      if (evt.key === 'Escape') finishEdit(false);
      if (evt.key === 'Enter' && !evt.shiftKey) {
        evt.preventDefault();
        finishEdit(true); 
      }
    };

    const blurHandler = () => finishEdit(true);
    target.addEventListener('keydown', keydownHandler);
    target.addEventListener('blur', blurHandler);
  });

  // 2. IMAGE REPLACEMENT / MANAGER
  const images = document.querySelectorAll('.polaroid img[data-img]');
  const popup = document.getElementById('imagePopup');
  const urlInput = document.getElementById('imgUrlInput');
  const btnCancel = document.getElementById('btnCancelImg');
  const btnSave = document.getElementById('btnSaveImg');
  
  let currentImgKey = null;
  let currentImgEl = null;

  images.forEach(img => {
    img.addEventListener('click', (e) => {
      e.stopPropagation(); // Mencegah fitur zoom terbuka
      currentImgKey = img.dataset.img;
      currentImgEl = img;
      urlInput.value = img.src.includes('empty') ? '' : img.src; 
      popup.classList.remove('hidden');
      urlInput.focus();
    });
  });

  btnCancel.addEventListener('click', () => popup.classList.add('hidden'));

  btnSave.addEventListener('click', async () => {
    const newUrl = urlInput.value.trim();
    popup.classList.add('hidden');
    showToast("Saving...");
    
    currentImgEl.src = newUrl || 'empty';
    if(newUrl) {
      currentImgEl.closest('.polaroid').classList.remove('empty-slot');
    }

    try {
      // Jika di-kosongkan, simpan sebagai string kosong agar hilang di visitor
      await saveData(currentImgKey, newUrl);
      showToast("Saved ✓");
    } catch(err) {
      showToast("Gagal menyimpan!");
    }
  });
}
