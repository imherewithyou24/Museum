import { listenToData } from './firebase.js';
import { initAdminMode } from './admin.js';

// Elements
const pinScreen = document.getElementById('pinScreen');
const loadingScreen = document.getElementById('loadingScreen');
const museumScreen = document.getElementById('museum');
const pinInput = document.getElementById('pinInput');
const dots = document.querySelectorAll('.dot');
const pinMessage = document.getElementById('pinMessage');
const btnEnter = document.getElementById('btnEnter');
const bgMusic = document.getElementById('bgMusic');
const musicIcon = document.getElementById('musicIcon');
const progressBar = document.getElementById('progressBar');

const PIN_VISITOR = "1326";
const PIN_ADMIN = "1937";
export let isAdmin = false;
let audioStarted = false;

// ==========================================================
// 1. SINKRONISASI REALTIME & GALLERY SYSTEM
// ==========================================================
listenToData((data) => {
  if (!data) return;
  
  // Text sync
  document.querySelectorAll('[data-editable]').forEach(el => {
    const key = el.dataset.editable;
    if (data[key] && !el.isEditing) el.textContent = data[key];
  });
  
  // Image sync (Empty URL = Hidden slot for visitor)
  document.querySelectorAll('.polaroid img[data-img]').forEach(img => {
    const key = img.dataset.img;
    const parentSlot = img.closest('.polaroid');
    
    if (data[key] !== undefined) {
      const url = data[key].trim();
      img.src = url || 'empty'; // Set placeholder if empty
      
      // Hide empty slots if NOT admin
      if (!isAdmin && (url === '' || url === 'empty')) {
        parentSlot.classList.add('empty-slot');
      } else {
        parentSlot.classList.remove('empty-slot');
      }
    }
  });
});

// ==========================================================
// 2. AUDIO EXPERIENCE (Halus, Safari Hack)
// ==========================================================
function smoothVolume(target, duration = 1000) {
  const startVol = bgMusic.volume;
  const change = target - startVol;
  const startTime = performance.now();
  
  function animate(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    bgMusic.volume = startVol + (change * progress);
    if (progress < 1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// ==========================================================
// 3. PIN & OPENING EXPERIENCE
// ==========================================================
pinScreen.addEventListener('click', () => pinInput.focus());

pinInput.addEventListener('input', (e) => {
  // Play audio on first input (Safari policy bypass)
  if (!audioStarted) {
    audioStarted = true;
    bgMusic.volume = 0.4; // 40% initial
    bgMusic.play().then(() => musicIcon.classList.remove('hidden'))
      .catch(err => console.log("Audio play failed:", err));
  }

  let value = e.target.value.replace(/\D/g, '').slice(0, 4);
  e.target.value = value;
  
  dots.forEach((dot, index) => {
    if (index < value.length) dot.classList.add('filled');
    else dot.classList.remove('filled');
  });

  pinMessage.classList.add('hidden');
  btnEnter.classList.add('hidden');

  if (value.length === 4) {
    if (value === PIN_VISITOR || value === PIN_ADMIN) {
      isAdmin = (value === PIN_ADMIN);
      // Animasi PIN Accepted ♡
      pinMessage.textContent = "PIN Accepted ♡";
      pinMessage.classList.remove('error', 'hidden');
      pinInput.blur();
      
      setTimeout(() => {
        btnEnter.classList.remove('hidden'); 
      }, 500);
    } else {
      document.querySelector('.pin-dots').classList.add('shake');
      pinMessage.textContent = "PIN salah.";
      pinMessage.classList.add('error');
      pinMessage.classList.remove('hidden');
      setTimeout(() => {
        document.querySelector('.pin-dots').classList.remove('shake');
        pinInput.value = '';
        dots.forEach(d => d.classList.remove('filled'));
      }, 500);
    }
  }
});

btnEnter.addEventListener('click', () => {
  pinScreen.classList.add('fade-out-screen');
  
  setTimeout(() => {
    pinScreen.classList.add('hidden');
    loadingScreen.classList.remove('hidden');
    smoothVolume(0.6, 1000); // Naik ke 60%
    
    // Loading max 1 detik
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      museumScreen.classList.remove('hidden');
      
      if (isAdmin) initAdminMode();
      
      // Volume tuning
      setTimeout(() => smoothVolume(0.9, 2000), 3000); // Ke 90% setelah 3 detik
      setTimeout(() => smoothVolume(1.0, 3000), 10000); // Ke 100% nanti
    }, 1000);
  }, 400); // Fade screen delay
});

// ==========================================================
// 4. MICRO-INTERACTIONS (Glow, Particles, Scroll Progress)
// ==========================================================
// Mouse Glow (Desktop Only)
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  const glow = document.getElementById('mouseGlow');
  document.addEventListener('mousemove', (e) => {
    glow.style.left = `${e.clientX}px`;
    glow.style.top = `${e.clientY}px`;
  });
}

// Generate Magical Dust & Stars
const particlesContainer = document.getElementById('particlesContainer');
for (let i = 0; i < 15; i++) {
  let dust = document.createElement('div');
  dust.className = 'dust';
  dust.style.left = `${Math.random() * 100}vw`;
  dust.style.width = `${Math.random() * 3 + 1}px`;
  dust.style.height = dust.style.width;
  dust.style.animationDuration = `${Math.random() * 5 + 5}s`;
  dust.style.animationDelay = `${Math.random() * 5}s`;
  particlesContainer.appendChild(dust);
}
for (let i = 0; i < 10; i++) {
  let star = document.createElement('div');
  star.className = 'star';
  star.style.left = `${Math.random() * 100}vw`;
  star.style.top = `${Math.random() * 100}vh`;
  star.style.width = `${Math.random() * 2 + 1}px`;
  star.style.height = star.style.width;
  star.style.animationDelay = `${Math.random() * 3}s`;
  particlesContainer.appendChild(star);
}

// Progress Bar & Page Turn (Intersection Observer)
const sections = document.querySelectorAll('.museum-section');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible'); // Memicu transisi Page Turn
    }
  });
}, { threshold: 0.2 });
sections.forEach(sec => observer.observe(sec));

museumScreen.addEventListener('scroll', () => {
  const scrollTotal = museumScreen.scrollHeight - museumScreen.clientHeight;
  const progress = (museumScreen.scrollTop / scrollTotal) * 100;
  progressBar.style.width = `${progress}%`;
});

// ==========================================================
// 5. ENVELOPE WIGGLE & OPEN
// ==========================================================
const envelope = document.getElementById('envelope');
const envelopeHint = document.getElementById('envelopeHint');
const scrollIndicator = document.getElementById('scrollIndicator');

envelope.addEventListener('click', () => {
  if (!envelope.classList.contains('open')) {
    envelope.classList.remove('wiggle'); // Berhenti goyang
    envelope.classList.add('open');
    envelopeHint.classList.add('hidden');
    setTimeout(() => scrollIndicator.classList.remove('hidden'), 1000);
  }
});

// ==========================================================
// 6. GALLERY & POLAROID ZOOM SYSTEM
// ==========================================================
const galleryTrack = document.getElementById('galleryTrack');
document.getElementById('btnPrev').addEventListener('click', () => {
  galleryTrack.scrollBy({ left: -300, behavior: 'smooth' });
});
document.getElementById('btnNext').addEventListener('click', () => {
  galleryTrack.scrollBy({ left: 300, behavior: 'smooth' });
});

// Zoom Feature
const zoomOverlay = document.getElementById('zoomOverlay');
const zoomImage = document.getElementById('zoomImage');
const zoomText = document.getElementById('zoomText');

document.querySelectorAll('.polaroid').forEach(polaroid => {
  polaroid.addEventListener('click', (e) => {
    // Kalau admin klik fotonya, itu untuk ngedit, bukan nge-zoom.
    if (isAdmin && e.target.tagName === 'IMG') return;
    
    const img = polaroid.querySelector('img');
    const cap = polaroid.querySelector('.caption');
    if (img.src && !img.src.includes('empty')) {
      zoomImage.src = img.src;
      zoomText.textContent = cap.textContent;
      zoomOverlay.classList.add('active');
    }
  });
});

document.getElementById('closeZoom').addEventListener('click', () => {
  zoomOverlay.classList.remove('active');
});

// Replay
document.getElementById('btnReplay').addEventListener('click', (e) => {
  if (isAdmin || e.target.isEditing) return; 
  window.location.reload();
});
