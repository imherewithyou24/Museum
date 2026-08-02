// ==========================================================
// app.js — visitor-facing museum experience with REALTIME Sync
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

// 1. [REALTIME] Load Config & Identity
function loadConfig(){
  listenToDocument('config', 'settings', (data) => {
    if(data) {
      AppState.config = data;
      applyIdentity();
    } else {
      AppState.config = { visitorPin: "1326", creatorPin: "1937" };
    }
  });
}

export function applyIdentity(){
  const cfg = AppState.config || {};
  
  // Update UI HANYA JIKA elemen sedang tidak diedit oleh Admin, 
  // agar teks tidak ter-reset saat Admin sedang ngetik.
  const updateIfNotEditing = (selector, val) => {
    const el = $(selector);
    if(el && document.activeElement !== el && val) el.textContent = val;
  };

  updateIfNotEditing('.pin-eyebrow', cfg.museumName);
  updateIfNotEditing('.pin-title', cfg.pinTitle);
  updateIfNotEditing('.pin-subtitle', cfg.welcomeMsg);

  if(cfg.bgImage){
    $('#pinScreen').style.setProperty('--pin-bg-image', `url('${cfg.bgImage}')`);
    $('#pinScreen').classList.add('has-custom-bg');
  }
}

// 2. PIN AUTHENTICATION
const pinScreen    = $('#pinScreen');
const pinRealInput = $('#pinRealInput');
const pinDotsWrap  = $('#pinDots');
const pinDots      = $all('.pin-dot');
const pinError     = $('#pinError');
const pinEnterBtn  = $('#pinEnterBtn');

pinScreen.addEventListener('click', ()=> pinRealInput.focus());

pinRealInput.addEventListener('input', ()=>{
  const value = pinRealInput.value.replace(/\D/g,'').slice(0,4);
  pinRealInput.value = value;
  pinDots.forEach((dot, i)=> dot.classList.toggle('filled', i < value.length));
});

// Tombol Open Museum & Tekan Enter Keyboard
pinEnterBtn.addEventListener('click', () => handlePinSubmit(pinRealInput.value));
pinRealInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handlePinSubmit(pinRealInput.value);
});

async function handlePinSubmit(value){
  if(value.length !== 4) return;
  if(!AppState.config) return;

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

// 3. FAST CINEMATIC LOADING (Max 1 detik)
const loadingScreen = $('#loadingScreen');
const loadingText   = $('#loadingText');
const loadingFill   = $('#loadingProgressFill');

function beginCinematicSequence(){
  hide(pinScreen);
  show(loadingScreen);
  
  loadingText.textContent = "Checking invitation...";
  loadingFill.style.width = '40%';
  
  setTimeout(() => {
    loadingText.textContent = "Opening museum...";
    loadingFill.style.width = '100%';
    
    setTimeout(() => {
      hide(loadingScreen);
      show($('#envelopeScreen'));
      spawnDust($('#envelopeScreen'));
    }, 500);
  }, 500);
}

// 4. ENVELOPE ANIMATION
const envelopeWrap = $('#envelopeWrap');
const waxSeal       = $('#waxSeal');
const envelopeHint  = $('#envelopeHint');
const bgm           = $('#bgm');
const miniPlayer    = $('#miniPlayer');

envelopeWrap.addEventListener('click', ()=>{
  const stage = envelopeWrap.dataset.stage;

  if(stage === 'idle'){
    envelopeWrap.dataset.stage = 'cracking';
    envelopeHint.textContent = '';
    playSFX('sfxSealCrack');
    waxSeal.classList.add('cracked');

    setTimeout(()=>{
      playSFX('sfxWaxFall');
      waxSeal.classList.add('fallen');
    }, 500);

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

  } else if(stage === 'reading'){
    envelopeWrap.dataset.stage = 'done';
    setTimeout(()=>{
      hide($('#envelopeScreen'));
      show($('#entranceScreen'));
      playSFX('sfxFootstep');
      setTimeout(enterMuseum, AppState.reducedMotion ? 800 : 2500);
    }, 500);
  }
});

// 5. MUSEUM NAVIGATION
const floorPlanToggle = $('#floorPlanToggle');
const floorPlan = $('#floorPlan');
floorPlanToggle.addEventListener('click', ()=> floorPlan.classList.toggle('visible'));

function markHallVisited(hallNumber){
  AppState.visitedHalls.add(hallNumber);
  const cell = document.querySelector(`.floor-cell[data-hall="${hallNumber}"]`);
  if(cell) cell.classList.add('visited');
}

let hallVisitTrackingWired = false;
function wireHallVisitTracking(){
  if(hallVisitTrackingWired) return;
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting) markHallVisited(entry.target.dataset.hall);
    });
  }, { threshold: 0.5, root: $('#museum') });
  $all('.hall').forEach(h => io.observe(h));
  hallVisitTrackingWired = true;
}

// Mouse Glow
(function wireMouseGlow(){
  const glow = $('#mouseGlow');
  if(!window.matchMedia('(hover: hover)').matches) return; 
  let raf = null;
  document.addEventListener('mousemove', (e)=>{
    if(AppState.reducedMotion) return;
    glow.classList.add('active');
    if(raf) return;
    raf = requestAnimationFrame(()=>{
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
      raf = null;
    });
  });
  document.addEventListener('mouseleave', ()=> glow.classList.remove('active'));
})();

// Cinematic Transition
const transitionOverlay = $('#transitionOverlay');
const transitionText = $('#transitionText');
const TRANSITION_LINES = ['Preparing the next exhibit...', 'Turning the page...', 'Almost there...'];

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

$('#musicToggle').addEventListener('click', (e)=>{
  e.stopPropagation();
  if(AppState.musicPlaying){
    bgm.pause(); AppState.musicPlaying = false;
  } else {
    bgm.play().catch(()=>{}); AppState.musicPlaying = true;
  }
});

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
      document.getElementById(`hall${currentHallIndex}`).scrollIntoView({ behavior: 'auto' });
      updateMuseumUI();
    });
  }
});
$('#navNext').addEventListener('click', ()=>{
  if(currentHallIndex < totalHalls){
    currentHallIndex++;
    withHallTransition(()=>{
      document.getElementById(`hall${currentHallIndex}`).scrollIntoView({ behavior: 'auto' });
      updateMuseumUI();
    });
  }
});

export function enterMuseum(){
  $('#museum').classList.add('active');
  $('#museum').scrollTop = 0; 
  floorPlanToggle.classList.add('visible');
  $('#museumProgressWrap').classList.remove('hidden');
  $('#museumProgressWrap').classList.add('visible');
  $('#hallNavigation').classList.remove('hidden');
  $('#hallNavigation').classList.add('visible');

  // [CREATOR MODE ACTIVATION]
  if(AppState.isCreator){
    $('#creatorBadge').classList.remove('hidden');
    document.body.classList.add('edit-mode-active');
    // Membangunkan admin.js untuk memasang fitur Inline Editor
    document.dispatchEvent(new Event('creatorModeActivated'));
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
          currentHallIndex = newIndex; updateMuseumUI();
        }
        scrollTicking = false;
      });
    }, { passive: true });
    museumScrollWired = true;
  }

  wireHallVisitTracking();
  loadSiteContent();
  loadFixedLetters();
  showStepperStage(0);
}

// 6. [REALTIME] SYNC ENGINE
function updateIfInactive(el, val) {
  if(el && document.activeElement !== el && val) el.textContent = val;
}

function loadSiteContent(){
  listenToDocument('content', 'site', (data) => {
    if(!data) return;
    Object.entries(data).forEach(([key, value]) => {
      const el = document.querySelector(`[data-editable="${key}"]`);
      updateIfInactive(el, value);
    });
  });
}

function loadFixedLetters(){
  listenToCollection('letters', null, (items) => {
    const map = {};
    items.forEach(l => { if(l.type && l.type !== 'love') map[l.type] = l.content; });
    updateIfInactive($('#hall1LetterText'), map.opening);
    updateIfInactive($('#stepperThanksText'), map.thankyou);
    updateIfInactive($('#stepperSorryText'), map.sorry);
    updateIfInactive($('#stepperFinalText'), map.final);
    updateIfInactive($('#stepperQuoteText'), map.quote);
  });
}

// Stepper Hall 6
const stepperStages = ['thanks','sorry','final','quote'];
let stepperIndex = 0;

function showStepperStage(index){
  const stage = stepperStages[index];
  $all('.stepper-panel').forEach(p => p.classList.toggle('active', p.dataset.stage === stage));
  $all('.stepper-dot').forEach(d => d.classList.toggle('active', d.dataset.stage === stage));
  $('#stepperNext').textContent = (index === stepperStages.length - 1) ? 'Tutup Museum' : 'Lanjutkan';
}

$('#stepperNext').addEventListener('click', ()=>{
  if(stepperIndex < stepperStages.length - 1){
    stepperIndex++;
    showStepperStage(stepperIndex);
  } else {
    triggerEnding();
  }
});

// Ending
function triggerEnding(){
  const ending = $('#endingScreen');
  ending.classList.add('active');

  let v = bgm.volume;
  const fadeOut = setInterval(()=>{
    v -= 0.08;
    bgm.volume = Math.max(v, 0);
    if(v <= 0){ clearInterval(fadeOut); bgm.pause(); }
  }, 120);

  $all('.lights-off-band').forEach((band, i)=> setTimeout(()=> band.classList.add('off'), i * 150));

  setTimeout(()=>{
    spawnStars($('#starField'), 40);
    $('#endingQuote').classList.add('visible');
    setTimeout(()=> $('#visitAgainBtn').classList.add('visible'), 800);
  }, 1000);
}

$('#visitAgainBtn').addEventListener('click', ()=> location.reload());

document.addEventListener('load', (e)=>{
  if(e.target.tagName === 'IMG' && e.target.hasAttribute('loading')) {
    e.target.classList.add('loaded');
  }
}, true);

// INIT
applyMotionPreference();
spawnDust($('#pinAtmosphere'), 10);
loadConfig();
