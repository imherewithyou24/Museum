import { listenToData } from './firebase.js';
import { initAdminMode } from './admin.js';

const pinScreen = document.getElementById('pinScreen');
const loadingScreen = document.getElementById('loadingScreen');
const museumScreen = document.getElementById('museum');
const pinInput = document.getElementById('pinInput');
const dots = document.querySelectorAll('.dot');
const pinError = document.getElementById('pinError');
const btnEnter = document.getElementById('btnEnter');
const bgMusic = document.getElementById('bgMusic');

const PIN_VISITOR = "1326";
const PIN_ADMIN = "1937";
export let isAdmin = false;

// ==========================================================
// 1. SINKRONISASI REALTIME (Ajaibnya Firebase di sini)
// ==========================================================
listenToData((data) => {
  if (!data) return;
  
  // Sinkronisasi Teks secara Realtime
  document.querySelectorAll('[data-editable]').forEach(el => {
    const key = el.dataset.editable;
    // Jangan ubah teks kalau admin sedang mengedit elemen ini
    if (data[key] && !el.isEditing) {
      el.textContent = data[key];
    }
  });
  
  // Sinkronisasi Link Foto secara Realtime
  document.querySelectorAll('img[data-img]').forEach(img => {
    const key = img.dataset.img;
    if (data[key]) {
      img.src = data[key];
    }
  });
});

// ==========================================================
// 2. LOGIKA LAYAR PIN 
// ==========================================================
pinScreen.addEventListener('click', () => pinInput.focus());

pinInput.addEventListener('input', (e) => {
  let value = e.target.value.replace(/\D/g, '').slice(0, 4);
  e.target.value = value;
  
  // Menyalakan titik-titik PIN
  dots.forEach((dot, index) => {
    if (index < value.length) dot.classList.add('filled');
    else dot.classList.remove('filled');
  });

  pinError.classList.add('hidden');
  btnEnter.classList.add('hidden');

  // Jika PIN sudah 4 digit
  if (value.length === 4) {
    if (value === PIN_VISITOR || value === PIN_ADMIN) {
      isAdmin = (value === PIN_ADMIN);
      btnEnter.classList.remove('hidden'); 
    } else {
      // Efek shake jika PIN salah
      document.querySelector('.pin-dots').classList.add('shake');
      pinError.classList.remove('hidden');
      setTimeout(() => {
        document.querySelector('.pin-dots').classList.remove('shake');
        pinInput.value = '';
        dots.forEach(d => d.classList.remove('filled'));
      }, 500);
    }
  }
});

// ==========================================================
// 3. LOGIKA MASUK MUSEUM & MUSIK
// ==========================================================
btnEnter.addEventListener('click', () => {
  pinScreen.classList.add('hidden');
  loadingScreen.classList.remove('hidden');
  
  // Play BGM & Fade-in Audio
  bgMusic.volume = 0;
  bgMusic.play().catch(e => console.log("Audio autoplay diblokir browser"));
  
  let fadeAudio = setInterval(() => {
    if (bgMusic.volume < 0.9) bgMusic.volume += 0.1;
    else clearInterval(fadeAudio);
  }, 200);

  // Animasi Loading 1 Detik
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
    museumScreen.classList.remove('hidden');
    
    // AKTIFKAN MODE ADMIN JIKA LOGIN PAKAI 1937
    if (isAdmin) {
      initAdminMode();
    }
  }, 1000);
});

// ==========================================================
// 4. LOGIKA SURAT BUKA & TOMBOL REPLAY
// ==========================================================
const envelope = document.getElementById('envelope');
const envelopeHint = document.getElementById('envelopeHint');
const scrollIndicator = document.getElementById('scrollIndicator');

envelope.addEventListener('click', () => {
  if (!envelope.classList.contains('open')) {
    envelope.classList.add('open');
    envelopeHint.classList.add('hidden');
    
    // Memunculkan petunjuk scroll ke bawah
    setTimeout(() => scrollIndicator.classList.remove('hidden'), 1000);
  }
});

const btnReplay = document.getElementById('btnReplay');
btnReplay.addEventListener('click', (e) => {
  // Jangan reload kalau yang ngeklik adalah Admin (supaya mode admin tidak hilang)
  // Atau jika admin sedang ngeklik untuk mengedit teks Replay-nya
  if (isAdmin || e.target.isEditing) return; 
  
  window.location.reload();
});
