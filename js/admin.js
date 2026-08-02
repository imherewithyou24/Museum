// ==========================================================
// admin.js — Creator-only features: Notion-style Inline Edit Mode
// ==========================================================
import { setSingleton } from './firebase.js';
import { $, $all } from './app.js';

let originalText = "";

// Mendengarkan sinyal dari app.js saat PIN Creator dimasukkan
document.addEventListener('creatorModeActivated', () => {
  
  $all('[data-editable]').forEach(el => {
    // Buat semua elemen teks bisa diketik
    el.contentEditable = "true";

    // Simpan teks asli saat mulai diklik (untuk fitur Cancel/Esc)
    el.addEventListener('focus', (e) => {
      originalText = e.target.innerText;
    });

    // Deteksi ketikan keyboard (Enter untuk Save, Esc untuk Batal)
    el.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Mencegah enter membuat baris baru
        e.target.blur();    // Hilangkan kursor
        await saveEdit(e.target);
      } 
      else if (e.key === 'Escape') {
        e.preventDefault();
        e.target.innerText = originalText; // Kembalikan ke teks semula
        e.target.blur();
      }
    });
  });

});

// Fungsi memunculkan notifikasi "Saving..." dan "✓ Saved"
function flashEditSavePill(text, isError = false) {
  const pill = $('#editSavePill');
  pill.textContent = text;
  pill.style.background = isError ? 'var(--error)' : 'var(--gold)';
  pill.style.color = isError ? '#fff' : '#0B0A0C';
  pill.classList.add('visible');
  
  // Hilangkan notifikasi setelah 2 detik
  setTimeout(() => pill.classList.remove('visible'), 2000);
}

// Fungsi mengirim teks baru ke Firebase
async function saveEdit(el) {
  const newValue = el.innerText.trim();
  const fieldKey = el.dataset.editable;
  if (!fieldKey) return;

  flashEditSavePill('Saving...');

  try {
    const parts = fieldKey.split('.');
    const domain = parts[0];

    // Cek atribut data-editable untuk menentukan lokasi simpan di database
    if (domain === 'letters') {
      const type = parts[1]; // misal: 'opening', 'thankyou'
      await setSingleton('letters', type, { type, content: newValue });
    } 
    else if (domain === 'config') {
      const field = parts[1]; // misal: 'museumName', 'welcomeMsg'
      await setSingleton('config', 'settings', { [field]: newValue });
    } 
    else if (domain === 'museum') {
      await setSingleton('content', 'site', { [fieldKey]: newValue });
    }
    
    flashEditSavePill('✓ Saved');
  } catch(err) {
    console.error('Save failed:', err);
    flashEditSavePill('Gagal menyimpan', true);
  }
}
