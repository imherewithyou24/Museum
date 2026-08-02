// ==========================================================
// app.js — Visitor Engine (Realtime Sync)
// ==========================================================
import { listenToDocument, listenToCollection } from './firebase.js';

export const AppState = {
  config: null,
  isCreator: false,
  musicPlaying: false,
  reducedMotion: false,
  visitedHalls: new Set(),
};

export function $(selector){ return document.querySelector(selector); }
export function $all(selector){ return document.querySelectorAll(selector); }
function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }

function playSFX(id){
  if(AppState.reducedMotion) return; 
  const el = document.getElementById(id);
  if(!el) return;
  el.currentTime = 0;
  el.play().catch(()=>{});
}

function applyMotionPreference(){
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  AppState.reducedMotion = mq.matches;
  document.body.classList.toggle('reduced-motion', mq.matches);
}

function spawnDust(container, count = 14){
  if(AppState.reducedMotion) return;
  for(let i=0;i<count;i++){
    const p = document.createElement('div');
    p.className = 'dust-particle';
    p.style.left = Math.random()*100 + '%';
    p.style.animationDuration = (8 + Math.random()*10) + 's';
    p.style.animationDelay = (Math.random()*8) + 's';
    container.appendChild(p);
  }
}

// --- REALTIME CONFIG LISTENER ---
listenToDocument("config", "settings", (data) => {
  AppState.config = data || { visitorPin: "1326", creatorPin: "1937" };
  applyIdentity();
});

export function applyIdentity(){
  const cfg = AppState.config || {};
  if(cfg.museumName) $('.pin-eyebrow').textContent = cfg.museumName;
  if(cfg.welcomeMsg) $('.pin-subtitle').textContent = cfg.welcomeMsg;
  if(cfg.bgImage){
    $('#pinScreen').style.setProperty('--pin-bg-image', `url('${cfg.bgImage}')`);
    $('#pinScreen').classList.add('has-custom-bg');
  }
}

// --- PIN AUTHENTICATION ---
const pinScreen    = $('#pinScreen');
const pinRealInput = $('#pinRealInput');
const pinDotsWrap  = $('#pinDots');
const pinDots      = $all('.pin-dot');
const pinError     = $('#pinError');

pinScreen.addEventListener('click', ()=> pinRealInput.focus());

pinRealInput.addEventListener('input', ()=>{
  const value = pinRealInput.value.replace(/\D/g,'').slice(0,4);
  pinRealInput.value = value;
  pinDots.forEach((dot, i)=> dot.classList.toggle('filled', i < value.length));
});

// Login menggunakan tombol Enter (Sesuai request)
$('#pinEnterBtn').addEventListener('click', () => {
  if (pinRealInput.value.length === 4) handlePinSubmit(pinRealInput.value);
});
pinRealInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter' && pinRealInput.value.length === 4) handlePinSubmit(pinRealInput.value);
});

function handlePinSubmit(value){
  if(value === AppState.config.creatorPin){
    AppState.isCreator = true;
    beginCinematicSequence();
    return;
  }
  if(value === AppState.config.visitorPin){
    AppState.isCreator = false;
    beginCinematicSequence();
    return;
  }

  pinDotsWrap.classList.add('shake');
  pinError.textContent = "PIN salah. Coba lagi.";
  setTimeout(()=>{
    pinDotsWrap.classList.remove('shake');
    pinRealInput.value = '';
    pinDots.forEach(dot=> dot.classList.remove('filled'));
  }, 500);
}

// --- CINEMATIC FAST LOADING ---
const loadingScreen = $('#loadingScreen');
const loadingText   = $('#loadingText');
const loadingFill   = $('#loadingProgressFill');

function beginCinematicSequence(){
  hide(pinScreen);
  show(loadingScreen);
  
  const texts = ["Checking invitation...", "Preparing museum...", "Opening museum..."];
  let i = 0;
  loadingText.textContent = texts[0];
  loadingFill.style.width = '33%';
  
  const interval = setInterval(()=>{
    i++;
    if(i >= texts.length){
      clearInterval(interval);
      loadingFill.style.width = '100%';
      setTimeout(()=> {
        hide(loadingScreen);
        show($('#envelopeScreen'));
        spawnDust($('#envelopeScreen'));
      }, 200);
      return;
    }
    loadingText.textContent = texts[i];
    loadingFill.style.width = ((i+1)/texts.length*100) + '%';
  }, 300); // Super cepat, under 1 sec
}

// --- ENVELOPE ---
const envelopeWrap = $('#envelopeWrap');
const waxSeal      = $('#waxSeal');
const envelopeHint = $('#envelopeHint');
const bgm          = $('#bgm');
const miniPlayer   = $('#miniPlayer');

envelopeWrap.addEventListener('click', ()=>{
  const stage = envelopeWrap.dataset.stage;
  if(stage === 'idle'){
    envelopeWrap.dataset.stage = 'cracking';
    envelopeHint.textContent = '';
    playSFX('sfxSealCrack');
    waxSeal.classList.add('cracked');
    setTimeout(()=>{ playSFX('sfxWaxFall'); waxSeal.classList.add('fallen'); }, 500);
    setTimeout(()=> envelopeWrap.dataset.stage = 'opened', 900);
    setTimeout(()=>{
      envelopeWrap.dataset.stage = 'peek';
      envelopeHint.textContent = 'Ketuk surat untuk membacanya';
      envelopeHint.style.opacity = 1;
    }, 1900);
  } else if(stage === 'peek'){
    envelopeWrap.dataset.stage = 'reading';
    playSFX('sfxPaper');
    envelopeHint.style.opacity = 0;
    fadeInMusic();
  } else if(stage === 'reading'){
    envelopeWrap.dataset.stage = 'done';
    setTimeout(beginEntranceSequence, 500);
  }
});

function fadeInMusic(){
  bgm.volume = 0;
  bgm.play().then(()=>{
    AppState.musicPlaying = true;
    miniPlayer.classList.add('visible');
    let v = 0;
    const fade = setInterval(()=>{
      v += 0.05;
      bgm.volume = Math.min(v, 1);
      if(v >= 1) clearInterval(fade);
    }, 120);
  }).catch(()=>{ miniPlayer.classList.add('visible'); });
}

function beginEntranceSequence(){
  hide($('#envelopeScreen'));
  show($('#entranceScreen'));
  playSFX('sfxFootstep');
  setTimeout(()=>{
    hide($('#entranceScreen'));
    enterMuseum();
  }, AppState.reducedMotion ? 800 : 3800);
}

// --- MUSEUM ENGINE & REALTIME HOOKS ---
let currentHallIndex = 1;
const totalHalls = 6;
let museumScrollWired = false;

function updateMuseumUI(){
  $('#navIndicator').textContent = `Hall ${currentHallIndex} of ${totalHalls}`;
  $('#navPrev').disabled = (currentHallIndex === 1);
  $('#navNext').disabled = (currentHallIndex === totalHalls);
  const progressPercent = Math.round((currentHallIndex / totalHalls) * 100);
  $('#progressPercent').textContent = `${progressPercent}%`;
  $('#museumProgressBar').style.width = `${progressPercent}%`;
}

$('#navPrev').addEventListener('click', ()=>{
  if(currentHallIndex > 1){
    currentHallIndex--;
    withHallTransition(()=>{
      document.getElementById(`hall${currentHallIndex}`).scrollIntoView({ behavior: AppState.reducedMotion ? 'auto' : 'smooth' });
      updateMuseumUI();
    });
  }
});
$('#navNext').addEventListener('click', ()=>{
  if(currentHallIndex < totalHalls){
    currentHallIndex++;
    withHallTransition(()=>{
      document.getElementById(`hall${currentHallIndex}`).scrollIntoView({ behavior: AppState.reducedMotion ? 'auto' : 'smooth' });
      updateMuseumUI();
    });
  }
});

export function enterMuseum(){
  $('#museum').classList.add('active');
  $('#museum').scrollTop = 0; 
  $('#floorPlanToggle').classList.add('visible');
  $('#museumProgressWrap').classList.remove('hidden');
  $('#museumProgressWrap').classList.add('visible');
  $('#hallNavigation').classList.remove('hidden');
  $('#hallNavigation').classList.add('visible');

  // CREATOR MODE: Otomatis Nyala!
  if(AppState.isCreator){
    $('#creatorBadge').classList.remove('hidden');
    document.body.classList.add('edit-mode-active');
  }

  currentHallIndex = 1;
  updateMuseumUI();

  if(!museumScrollWired){
    let scrollTicking = false;
    $('#museum').addEventListener('scroll', ()=>{
      if(scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(()=>{
        const scrollY = $('#museum').scrollTop;
        const windowH = window.innerHeight;
        const newIndex = Math.round(scrollY / windowH) + 1;
        if(newIndex !== currentHallIndex && newIndex >= 1 && newIndex <= totalHalls){
          currentHallIndex = newIndex;
          updateMuseumUI();
        }
        scrollTicking = false;
      });
    }, { passive: true });
    museumScrollWired = true;
  }

  wireHallVisitTracking();
  
  // MENGHIDUPKAN REALTIME LISTENERS 🔥
  listenToCollection('gallery', 'order', renderGallery);
  listenToCollection('scrapbook', 'order', renderScrapbook);
  listenToCollection('playlist', 'order', renderPlaylist);
  listenToCollection('letters', 'order', renderLoveLetters); 
  listenToCollection('letters', null, loadFixedLetters);
  listenToDocument('content', 'site', loadSiteContent);

  showStepperStage(0);

  const ambience = $('#sfxAmbience');
  if(ambience && !AppState.reducedMotion){
    ambience.volume = 0.12;
    ambience.play().catch(()=>{});
  }
}

// REALTIME DATA RENDERERS
function loadSiteContent(data){
  if(!data) return;
  Object.entries(data).forEach(([key, value])=>{
    const el = document.querySelector(`[data-editable="${key}"]`);
    // Jangan timpah teks kalau Creatormu lagi ngetik di elemen itu
    if(el && !el.isEditing) el.textContent = value;
  });
}

function loadFixedLetters(allLetters){
  if(allLetters.length === 0) return;
  const map = {};
  allLetters.forEach(l => { if(l.type && l.type !== 'love') map[l.type] = l.content; });
  
  const updateIfFree = (id, val) => { const el = $(id); if(el && !el.isEditing && val) el.textContent = val; };
  updateIfFree('#hall1LetterText', map.opening);
  updateIfFree('#stepperThanksText', map.thankyou);
  updateIfFree('#stepperSorryText', map.sorry);
  updateIfFree('#stepperFinalText', map.final);
  updateIfFree('#stepperQuoteText', map.quote);
}

function renderGallery(photos){
  const grid = $('#galleryGrid');
  if(photos.length === 0) return; // Hide if empty
  grid.innerHTML = '';
  photos.forEach((photo)=>{
    const frame = document.createElement('div');
    frame.className = 'frame-item mi-tap';
    // Perhatikan atribut data-editable yang dinamis
    frame.innerHTML = `<img src="${photo.src}" alt="${photo.caption || ''}" loading="lazy">
                       <span class="frame-num" data-editable="gallery.${photo.id}.caption">${photo.caption || 'Caption'}</span>`;
    frame.addEventListener('click', (e)=> {
      // Cegah klik lightbox kalau yang diklik adalah tulisan caption saat Edit Mode
      if (AppState.isCreator && e.target.tagName === 'SPAN') return; 
      openLightbox(photo);
    });
    grid.appendChild(frame);
  });
  markCachedImagesLoaded(grid);
}

const lightbox = $('#lightbox');
function openLightbox(photo){
  $('#lightboxImg').src = photo.src;
  $('#lightboxMeta').textContent = photo.caption || 'Momen';
  $('#lightboxStory').textContent = photo.story || '';
  
  // Set ID Dinamis untuk Edit Mode
  $('#lightboxMeta').dataset.editable = `gallery.${photo.id}.caption`;
  $('#lightboxStory').dataset.editable = `gallery.${photo.id}.story`;
  
  lightbox.classList.add('visible');
  playSFX('sfxPaper');
}
$('#lightboxClose').addEventListener('click', ()=> lightbox.classList.remove('visible'));

function renderScrapbook(items){
  const canvas = $('#scrapbookCanvas');
  if(items.length === 0) return;
  canvas.innerHTML = '';
  items.forEach(item=>{
    const el = document.createElement('div');
    el.className = `scrap-item ${item.type}`;
    el.style.left = item.x; el.style.top = item.y; el.style.transform = `rotate(${item.rotate || 0}deg)`;
    el.dataset.baseRotate = item.rotate || 0;

    if(item.type === 'polaroid'){
      el.innerHTML = `<img src="${item.src}" alt="">`;
    } else if(item.type === 'note'){
      // Beri data-editable dinamis
      el.innerHTML = `<span data-editable="scrapbook.${item.id}.text">${item.text || ''}</span>`;
    } else if(item.type === 'sticker'){
      el.innerHTML = `<span data-editable="scrapbook.${item.id}.emoji">${item.emoji || '★'}</span>`;
    }
    wireScrapTilt(el);
    canvas.appendChild(el);
  });
}

function renderPlaylist(tracks){
  const list = $('#playlistList');
  if(tracks.length === 0) return;
  list.innerHTML = '';
  tracks.forEach(track=>{
    const row = document.createElement('div');
    row.className = 'track-row';
    row.innerHTML = `
      <div class="vinyl" style="--cover:url('${track.cover||''}')"></div>
      <div class="track-meta">
        <div class="track-title" data-editable="playlist.${track.id}.title">${track.title}</div>
        <div class="track-artist" data-editable="playlist.${track.id}.artist">${track.artist||''}</div>
      </div>
      <div class="track-reason" data-editable="playlist.${track.id}.reason">${track.reason||''}</div>
      <div class="track-needle"></div>
    `;
    row.addEventListener('click', (e)=> {
      if (AppState.isCreator && e.target.closest('[data-editable]')) return; // Cegah nyanyi kalau lg ngedit
      toggleTrack(row, track);
    });
    list.appendChild(row);
  });
}

const trackPlayer = $('#trackPlayer');
let currentPlayingRow = null;
function toggleTrack(row, track){
  const isThisPlaying = row.classList.contains('playing');
  if(currentPlayingRow) currentPlayingRow.classList.remove('playing');
  trackPlayer.pause();
  if(isThisPlaying){
    currentPlayingRow = null;
    bgm.volume = 1; 
    return;
  }
  bgm.volume = 0.15; 
  trackPlayer.src = track.src;
  trackPlayer.play().catch(()=>{});
  row.classList.add('playing');
  currentPlayingRow = row;
}

function renderLoveLetters(allLetters){
  const letters = allLetters.filter(l => l.type === 'love');
  const grid = $('#miniEnvelopes');
  if(letters.length === 0) return;
  grid.innerHTML = '';
  letters.forEach((letter, i)=>{
    const env = document.createElement('div');
    env.className = 'mini-envelope mi-tap';
    env.innerHTML = `<span class="env-label" data-editable="letters.${letter.id}.label">${letter.label || 'Surat ' + (i+1)}</span>`;
    env.addEventListener('click', (e)=>{
      if (AppState.isCreator && e.target.tagName === 'SPAN') return;
      $('#letterModalText').textContent = letter.content || '';
      $('#letterModalText').dataset.editable = `letters.${letter.id}.content`; // Dinamis
      $('#letterModal').classList.add('visible');
      playSFX('sfxPaper');
    });
    grid.appendChild(env);
  });
}
$('#letterModalClose').addEventListener('click', ()=> $('#letterModal').classList.remove('visible'));

// --- OTHER UTILS ---
function wireHallVisitTracking(){
  const halls = $all('.hall');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        AppState.visitedHalls.add(entry.target.dataset.hall);
        const cell = document.querySelector(`.floor-cell[data-hall="${entry.target.dataset.hall}"]`);
        if(cell) cell.classList.add('visited');
      }
    });
  }, { threshold: 0.5, root: $('#museum') });
  halls.forEach(h => io.observe(h));
}

function wireScrapTilt(el){
  if(AppState.reducedMotion) return;
  const base = parseFloat(el.dataset.baseRotate || 0);
  el.addEventListener('pointermove', (e)=>{
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `rotate(${base + px*6}deg) translateY(${py*-4}px)`;
  });
  el.addEventListener('pointerleave', ()=> el.style.transform = `rotate(${base}deg)`);
}

const transitionOverlay = $('#transitionOverlay');
const transitionText = $('#transitionText');
const TRANSITION_LINES = ['Preparing the next exhibit...','Turning the page...','Almost there...'];
function withHallTransition(action){
  if(AppState.reducedMotion){ action(); return; }
  transitionText.textContent = TRANSITION_LINES[Math.floor(Math.random()*TRANSITION_LINES.length)];
  transitionOverlay.classList.remove('hidden');
  requestAnimationFrame(()=> transitionOverlay.classList.add('visible'));
  setTimeout(()=>{
    action();
    setTimeout(()=>{
      transitionOverlay.classList.remove('visible');
      setTimeout(()=> transitionOverlay.classList.add('hidden'), 650);
    }, 250);
  }, 350);
}

const stepperStages = ['thanks','sorry','final','quote'];
let stepperIndex = 0;
function showStepperStage(index){
  const stage = stepperStages[index];
  $all('.stepper-panel').forEach(p => p.classList.toggle('active', p.dataset.stage === stage));
  $all('.stepper-dot').forEach(d => d.classList.toggle('active', d.dataset.stage === stage));
}
$('#stepperNext').addEventListener('click', (e)=>{
  // Jangan navigasi kalau lagi ngedit teks tombolnya
  if (AppState.isCreator && e.target.isEditing) return;
  if(stepperIndex < stepperStages.length - 1){
    stepperIndex++;
    showStepperStage(stepperIndex);
  } else {
    $('#endingScreen').classList.add('active');
    let v = bgm.volume;
    const fadeOut = setInterval(()=>{
      v -= 0.08; bgm.volume = Math.max(v, 0);
      if(v <= 0){ clearInterval(fadeOut); bgm.pause(); }
    }, 120);
    $all('.lights-off-band').forEach((band, i)=> setTimeout(()=> band.classList.add('off'), i * 220));
    setTimeout(()=>{
      spawnStars($('#starField'), 60);
      $('#endingQuote').classList.add('visible');
      setTimeout(()=> $('#visitAgainBtn').classList.add('visible'), 800);
    }, 1600);
  }
});
$('#visitAgainBtn').addEventListener('click', ()=> location.reload());

$('#floorPlanToggle').addEventListener('click', ()=> $('#floorPlan').classList.toggle('visible'));
$all('.floor-cell').forEach(cell=>{
  cell.addEventListener('click', ()=>{
    const target = document.getElementById('hall' + cell.dataset.hall);
    if(target) target.scrollIntoView({ behavior: AppState.reducedMotion ? 'auto' : 'smooth' });
  });
});
$('#musicToggle').addEventListener('click', (e)=>{
  e.stopPropagation();
  if(AppState.musicPlaying){ bgm.pause(); AppState.musicPlaying = false; } 
  else { bgm.play().catch(()=>{}); AppState.musicPlaying = true; }
});
(function wireMouseGlow(){
  const glow = $('#mouseGlow');
  if(!window.matchMedia('(hover: hover)').matches) return;
  let raf = null;
  document.addEventListener('mousemove', (e)=>{
    if(AppState.reducedMotion) return;
    glow.classList.add('active');
    if(raf) return;
    raf = requestAnimationFrame(()=>{ glow.style.left = e.clientX+'px'; glow.style.top = e.clientY+'px'; raf=null; });
  });
  document.addEventListener('mouseleave', ()=> glow.classList.remove('active'));
})();
document.addEventListener('load', (e)=>{
  if(e.target.tagName === 'IMG' && e.target.hasAttribute('loading')) e.target.classList.add('loaded');
}, true);
function markCachedImagesLoaded(container){
  container.querySelectorAll('img[loading="lazy"]').forEach(img=>{
    if(img.complete && img.naturalWidth > 0) img.classList.add('loaded');
  });
}

applyMotionPreference();
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyMotionPreference);
spawnDust($('#pinAtmosphere'), 10);
