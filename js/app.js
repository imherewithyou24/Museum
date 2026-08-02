// ==========================================================
// app.js — visitor-facing museum experience: PIN, loading, envelope,
// museum navigation, halls 1-6 content, and the ending sequence.
// Creator-only features (Dashboard, Inline Edit, managers) live in
// admin.js, which imports the shared pieces exported below.
// ==========================================================
import { getDocument, fetchAll } from './firebase.js';

// 2. APP STATE
// ==========================================================
export const AppState = {
  config: null,
  isCreator: false,
  musicPlaying: false,
  reducedMotion: false,
  visitedHalls: new Set(),
};

// ==========================================================
// 3. UTILITIES
// ==========================================================
export function $(selector){ return document.querySelector(selector); }
export function $all(selector){ return document.querySelectorAll(selector); }
function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }

/** Plays a sound effect safely — never throws, silently no-ops if
 * the file isn't set yet or autoplay/interaction rules block it. */
function playSFX(id){
  if(AppState.reducedMotion) return; // treat SFX as part of "motion" experience toggle too
  const el = document.getElementById(id);
  if(!el) return;
  el.currentTime = 0;
  el.play().catch(()=>{ /* silently ignore — file may not be set yet */ });
}

/** Detects prefers-reduced-motion and applies a body-level class
 * so heavy decorative animation (dust, camera moves) is skipped. */
function applyMotionPreference(){
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  AppState.reducedMotion = mq.matches;
  document.body.classList.toggle('reduced-motion', mq.matches);
}

/** Spawns lightweight floating dust particles inside a container.
 * Uses only transform/opacity for performance; skipped entirely
 * under reduced-motion. */
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

/**
 * Loads /config/settings via firebase.js.
 * Expected shape:
 * { visitorPin, creatorPin, theme, font, animations }
 * Falls back to the defaults you specified if the doc is missing.
 */
async function loadConfig(){
  try{
    const data = await getDocument("config", "settings");
    if(data){
      AppState.config = data;
    } else {
      console.warn("No /config/settings document found yet — using fallback PINs.");
      AppState.config = { visitorPin: "1326", creatorPin: "1937" };
    }
  } catch(err){
    console.error("Failed to load config from Firestore:", err);
    AppState.config = { visitorPin: "1326", creatorPin: "1937" };
  }
}

/** Reflects config.settings.museumName / welcomeMsg / bgImage (set via
 * the Dashboard's Identity panel) onto the PIN screen. Safe to call
 * multiple times — it only touches text/style, never re-attaches
 * listeners, so it can run after every config load. */
export function applyIdentity(){
  const cfg = AppState.config || {};
  if(cfg.museumName) $('.pin-eyebrow').textContent = cfg.museumName;
  if(cfg.welcomeMsg) $('.pin-subtitle').textContent = cfg.welcomeMsg;
  if(cfg.bgImage){
    $('#pinScreen').style.setProperty('--pin-bg-image', `url('${cfg.bgImage}')`);
    $('#pinScreen').classList.add('has-custom-bg');
  }
}

// ==========================================================
// 4. PIN AUTHENTICATION (Apple-style dot passcode)
// ==========================================================
const pinScreen    = $('#pinScreen');
const pinRealInput = $('#pinRealInput');
const pinDotsWrap  = $('#pinDots');
const pinDots      = $all('.pin-dot');
const pinError     = $('#pinError');

// Tapping anywhere on the PIN screen focuses the hidden input,
// so it behaves like a native passcode screen (no visible textbox).
pinScreen.addEventListener('click', ()=> pinRealInput.focus());

pinRealInput.addEventListener('input', ()=>{
  const value = pinRealInput.value.replace(/\D/g,'').slice(0,4);
  pinRealInput.value = value;
  pinDots.forEach((dot, i)=> dot.classList.toggle('filled', i < value.length));
  if(value.length === 4){
    handlePinSubmit(value);
  }
});

async function handlePinSubmit(value){
  if(!AppState.config){ await loadConfig(); }

  if(value === AppState.config.creatorPin){
    AppState.isCreator = true;
    // Creator now walks through the same envelope/entrance experience
    // as a visitor, then gets floating Edit Mode / Dashboard controls
    // once inside the museum — see enterMuseum().
    beginCinematicSequence();
    return;
  }
  if(value === AppState.config.visitorPin){
    AppState.isCreator = false;
    beginCinematicSequence();
    return;
  }

  // Wrong PIN feedback
  pinDotsWrap.classList.add('shake');
  pinError.textContent = "PIN salah. Coba lagi.";
  setTimeout(()=>{
    pinDotsWrap.classList.remove('shake');
    pinRealInput.value = '';
    pinDots.forEach(dot=> dot.classList.remove('filled'));
  }, 500);
}

// ==========================================================
// 5. CINEMATIC LOADING (progressive light + camera-like movement)
// ==========================================================
const loadingScreen = $('#loadingScreen');
const loadingText   = $('#loadingText');
const loadingFill   = $('#loadingProgressFill');

const loadingMessages = [
  "Validating PIN...",
  "Preparing your private exhibition...",
  "Collecting memories...",
  "Turning on the lights...",
  "Please wait..."
];

function beginCinematicSequence(){
  hide(pinScreen);
  show(loadingScreen);
  runLoadingSequence().then(()=>{
    hide(loadingScreen);
    show($('#envelopeScreen'));
    spawnDust($('#envelopeScreen'));
  });
}

function runLoadingSequence(){
  return new Promise((resolve)=>{
    let i = 0;
    loadingText.textContent = loadingMessages[0];
    loadingFill.style.width = (100/loadingMessages.length) + '%';
    const interval = setInterval(()=>{
      i++;
      if(i >= loadingMessages.length){
        clearInterval(interval);
        loadingFill.style.width = '100%';
        setTimeout(resolve, 500);
        return;
      }
      loadingText.style.opacity = 0;
      setTimeout(()=>{
        loadingText.textContent = loadingMessages[i];
        loadingText.style.opacity = 1;
        loadingFill.style.width = ((i+1)/loadingMessages.length*100) + '%';
      }, 400);
    }, 1400);
  });
}

// ==========================================================
// 6. ENVELOPE ANIMATION (multi-stage, emotional)
// Stages: idle -> cracking -> peek -> reading -> done
// ==========================================================
const envelopeWrap = $('#envelopeWrap');
const waxSeal       = $('#waxSeal');
const envelopeHint  = $('#envelopeHint');
const bgm           = $('#bgm');
const miniPlayer    = $('#miniPlayer');

envelopeWrap.addEventListener('click', ()=>{
  const stage = envelopeWrap.dataset.stage;

  if(stage === 'idle'){
    runEnvelopeOpenSequence();
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

function runEnvelopeOpenSequence(){
  envelopeWrap.dataset.stage = 'cracking';
  envelopeHint.textContent = '';
  playSFX('sfxSealCrack');
  waxSeal.classList.add('cracked');

  setTimeout(()=>{
    playSFX('sfxWaxFall');
    waxSeal.classList.add('fallen');
  }, 500);

  setTimeout(()=>{
    envelopeWrap.dataset.stage = 'opened';
  }, 900);

  setTimeout(()=>{
    envelopeWrap.dataset.stage = 'peek';
    envelopeHint.textContent = 'Ketuk surat untuk membacanya';
    envelopeHint.style.opacity = 1;
  }, 1900);
}

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
  }).catch((err)=>{
    console.warn("Music couldn't autoplay:", err);
    miniPlayer.classList.add('visible'); // let user press play manually
  });
}

// ==========================================================
// 7. MUSEUM ENTRANCE (corridor / threshold sequence)
// ==========================================================
function beginEntranceSequence(){
  hide($('#envelopeScreen'));
  const entrance = $('#entranceScreen');
  show(entrance);
  playSFX('sfxFootstep');

  const duration = AppState.reducedMotion ? 800 : 3800;
  setTimeout(()=>{
    hide(entrance);
    enterMuseum();
  }, duration);
}

// ==========================================================
// 8. FLOOR PLAN NAVIGATION
// ==========================================================
const floorPlanToggle = $('#floorPlanToggle');
const floorPlan = $('#floorPlan');

floorPlanToggle.addEventListener('click', ()=>{
  floorPlan.classList.toggle('visible');
});

function markHallVisited(hallNumber){
  AppState.visitedHalls.add(hallNumber);
  const cell = document.querySelector(`.floor-cell[data-hall="${hallNumber}"]`);
  if(cell) cell.classList.add('visited');
}

$all('.floor-cell').forEach(cell=>{
  cell.addEventListener('click', ()=>{
    const target = document.getElementById('hall' + cell.dataset.hall);
    if(target) target.scrollIntoView({ behavior: AppState.reducedMotion ? 'auto' : 'smooth' });
  });
});

/** Auto-marks a Hall as visited (and lights up its floor-plan cell)
 * the moment it's scrolled into view — no manual click required.
 * Guarded so re-entering the museum (e.g. via "Preview as Girlfriend",
 * which can be clicked repeatedly) never stacks a second/third
 * IntersectionObserver watching the same 6 halls — that was a real
 * memory/perf leak on every dashboard <-> museum round trip. */
let hallVisitTrackingWired = false;
function wireHallVisitTracking(){
  if(hallVisitTrackingWired) return;
  const halls = $all('.hall');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        markHallVisited(entry.target.dataset.hall);
      }
    });
  }, { threshold: 0.5, root: $('#museum') });
  halls.forEach(h => io.observe(h));
  hallVisitTrackingWired = true;
}

// ==========================================================
// 8b. MOUSE GLOW 
// ==========================================================
(function wireMouseGlow(){
  const glow = $('#mouseGlow');
  if(!window.matchMedia('(hover: hover)').matches) return; // desktop/mouse only, matches the CSS gate
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

// ==========================================================
// 8c. CINEMATIC HALL-TRANSITION OVERLAY 
// ==========================================================
const transitionOverlay = $('#transitionOverlay');
const transitionText = $('#transitionText');
const TRANSITION_LINES = [
  'Preparing the next exhibit...',
  'Turning the page...',
  'Almost there...',
];

/** Briefly shows the cinematic black overlay, runs `action` (a hall
 * scroll) while hidden underneath it, then fades it back out. Skips
 * the visual entirely under reduced-motion — it would just be an
 * annoying flash with nothing to smooth over. */
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

// ==========================================================
// 9. MUSIC CONTROLS
// ==========================================================
$('#musicToggle').addEventListener('click', (e)=>{
  e.stopPropagation();
  if(AppState.musicPlaying){
    bgm.pause();
    AppState.musicPlaying = false;
  } else {
    bgm.play().catch(()=>{});
    AppState.musicPlaying = true;
  }
});


// ==========================================================
// 10. ENTER MUSEUM / DASHBOARD
// ==========================================================
let currentHallIndex = 1;
const totalHalls = 6;
let museumScrollWired = false; // guards against attaching the scroll listener twice

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
  $('#museum').scrollTop = 0; // always resume at Hall 1, esp. important when re-entering via Preview
  floorPlanToggle.classList.add('visible');

  $('#museumProgressWrap').classList.remove('hidden');
  $('#museumProgressWrap').classList.add('visible');
  $('#hallNavigation').classList.remove('hidden');
  $('#hallNavigation').classList.add('visible');

  if(AppState.isCreator){
    $('#adminFloatControls').classList.remove('hidden');
  }

  currentHallIndex = 1;
  updateMuseumUI();

  // Keeps the progress bar / bottom nav indicator in sync with manual
  // scrolling, on top of the click-to-navigate buttons above. Guarded
  // so re-entering the museum in the same session never double-attaches.
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
  loadGalleryPhotos();
  loadScrapbookItems();
  loadPlaylist();
  loadLoveLetters();
  loadFixedLetters();
  loadSiteContent();
  showStepperStage(0);

  // Ambience loop existed as an audio hook but was never actually
  // triggered anywhere — starts it softly under the main bgm.
  const ambience = $('#sfxAmbience');
  if(ambience && !AppState.reducedMotion){
    ambience.volume = 0.12;
    ambience.play().catch(()=>{ /* file may not be set yet, or blocked until interaction */ });
  }
}

/** Hydrates hall titles & curator notes (anything under the
 * "museum.*" field-key namespace) from /content/site, so edits
 * made via Edit Mode persist across future visits. */
async function loadSiteContent(){
  try{
    const data = await getDocument('content', 'site');
    if(!data) return;
    Object.entries(data).forEach(([key, value])=>{
      const el = document.querySelector(`[data-editable="${key}"]`);
      if(el) el.textContent = value;
    });
  } catch(err){
    console.warn('Site content not ready yet — using defaults.', err);
  }
}

// ---------- Hall 2: Memory Gallery ----------
// Fallback sample used only until the Dashboard (Step 4) lets the
// creator upload real photos into the /gallery Firestore collection.
const FALLBACK_GALLERY = [
  { src: 'REPLACE_WITH_PHOTO_1.jpg', caption: 'Panggilan video pertama', story: 'Jam segini, dua tahun lalu, kita masih canggung nyari topik obrolan.' },
  { src: 'REPLACE_WITH_PHOTO_2.jpg', caption: 'Ulang tahunmu lewat layar', story: 'Aku nyanyi jelek banget, tapi kamu tetap dengerin sampai habis.' },
  { src: 'REPLACE_WITH_PHOTO_3.jpg', caption: 'Strip fotobooth', story: 'Empat detik yang kita ulang berkali-kali biar hasilnya lucu.' },
  { src: 'REPLACE_WITH_PHOTO_4.jpg', caption: 'Malam susah tidur', story: 'Kita telepon sampai salah satu ketiduran duluan.' },
];

async function loadGalleryPhotos(){
  let photos = FALLBACK_GALLERY;
  try{
    const items = await fetchAll('gallery', 'order');
    if(items.length) photos = items;
  } catch(err){
    console.warn("Gallery collection not ready yet — using fallback photos.", err);
  }
  renderGallery(photos);
}

function renderGallery(photos){
  const grid = $('#galleryGrid');
  grid.innerHTML = '';
  photos.forEach((photo, i)=>{
    const frame = document.createElement('div');
    frame.className = 'frame-item mi-tap';
    frame.innerHTML = `<img src="${photo.src}" alt="${photo.caption || ''}" loading="lazy"><span class="frame-num">${String(i+1).padStart(2,'0')}</span>`;
    frame.addEventListener('click', ()=> openLightbox(photo));
    grid.appendChild(frame);
  });
  markCachedImagesLoaded(grid);
}

const lightbox = $('#lightbox');
function openLightbox(photo){
  $('#lightboxImg').src = photo.src;
  $('#lightboxImg').alt = photo.caption || '';
  $('#lightboxMeta').textContent = photo.caption || 'Momen';
  $('#lightboxStory').textContent = photo.story || '';
  lightbox.classList.add('visible');
  playSFX('sfxPaper');
}
$('#lightboxClose').addEventListener('click', ()=> lightbox.classList.remove('visible'));
lightbox.addEventListener('click', (e)=>{ if(e.target === lightbox) lightbox.classList.remove('visible'); });

// ---------- Hall 3: Scrapbook ----------
// Fallback layout used until Dashboard's Scrapbook Manager (Step 4)
// lets the creator add/reposition items via /scrapbook collection.
const FALLBACK_SCRAPBOOK = [
  { type:'polaroid', src:'REPLACE_WITH_POLAROID_1.jpg', x:'8%',  y:'6%',  rotate:-6 },
  { type:'tape',     x:'6%',  y:'2%',  rotate:-10 },
  { type:'note',     text:'“jangan lupa makan ya” — kamu, tiap malam',     x:'52%', y:'10%', rotate:5 },
  { type:'polaroid', src:'REPLACE_WITH_POLAROID_2.jpg', x:'46%', y:'42%', rotate:4 },
  { type:'tape',     x:'70%', y:'38%', rotate:8 },
  { type:'sticker',  emoji:'🌙', x:'14%', y:'54%', rotate:-4 },
  { type:'note',     text:'daftar lagu yang kamu putar tiap kangen',       x:'10%', y:'70%', rotate:-3 },
  { type:'sticker',  emoji:'✉️', x:'68%', y:'72%', rotate:6 },
];

async function loadScrapbookItems(){
  let items = FALLBACK_SCRAPBOOK;
  try{
    const fetched = await fetchAll('scrapbook', 'order');
    if(fetched.length) items = fetched;
  } catch(err){
    console.warn("Scrapbook collection not ready yet — using fallback layout.", err);
  }
  renderScrapbook(items);
}

function renderScrapbook(items){
  const canvas = $('#scrapbookCanvas');
  canvas.innerHTML = '';
  items.forEach(item=>{
    const el = document.createElement('div');
    el.className = `scrap-item ${item.type}`;
    el.style.left = item.x;
    el.style.top = item.y;
    el.style.transform = `rotate(${item.rotate || 0}deg)`;
    el.dataset.baseRotate = item.rotate || 0;

    if(item.type === 'polaroid'){
      el.innerHTML = `<img src="${item.src}" alt="">`;
    } else if(item.type === 'note'){
      el.textContent = item.text || '';
    } else if(item.type === 'sticker'){
      el.textContent = item.emoji || '★';
    }
    // tape has no inner content — just the visual strip

    wireScrapTilt(el);
    canvas.appendChild(el);
  });
}

/** Gives each scrapbook item a subtle physical-feel tilt that follows
 * the pointer, layered on top of its base rotation. Skipped entirely
 * under reduced-motion for both performance and comfort. */
function wireScrapTilt(el){
  if(AppState.reducedMotion) return;
  const base = parseFloat(el.dataset.baseRotate || 0);
  el.addEventListener('pointermove', (e)=>{
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `rotate(${base + px*6}deg) translateY(${py*-4}px)`;
  });
  el.addEventListener('pointerleave', ()=>{
    el.style.transform = `rotate(${base}deg)`;
  });
}

// ---------- Hall 4: Playlist (vinyl) ----------
// Fallback sample used until Dashboard's Playlist Manager (Step 4)
// lets the creator add real tracks into the /playlist collection.
const FALLBACK_PLAYLIST = [
  { title:'Lagu yang kita putar tiap video call', artist:'—', reason:'Ini lagu latar waktu kita ngobrol jam 2 pagi.', src:'REPLACE_WITH_SONG_1.mp3', cover:'' },
  { title:'Lagu ulang tahunmu', artist:'—', reason:'Aku setel ini pas kirim ucapan pertama kali.', src:'REPLACE_WITH_SONG_2.mp3', cover:'' },
  { title:'Lagu waktu kita kangen banget', artist:'—', reason:'Liriknya kayak ngomongin kita banget.', src:'REPLACE_WITH_SONG_3.mp3', cover:'' },
];

async function loadPlaylist(){
  let tracks = FALLBACK_PLAYLIST;
  try{
    const fetched = await fetchAll('playlist', 'order');
    if(fetched.length) tracks = fetched;
  } catch(err){
    console.warn("Playlist collection not ready yet — using fallback tracks.", err);
  }
  renderPlaylist(tracks);
}

const trackPlayer = $('#trackPlayer');
let currentPlayingRow = null;

function renderPlaylist(tracks){
  const list = $('#playlistList');
  list.innerHTML = '';
  tracks.forEach(track=>{
    const row = document.createElement('div');
    row.className = 'track-row';
    row.innerHTML = `
      <div class="vinyl" style="--cover:url('${track.cover||''}')"></div>
      <div class="track-meta">
        <div class="track-title">${track.title}</div>
        <div class="track-artist">${track.artist||''}</div>
      </div>
      <div class="track-reason">${track.reason||''}</div>
      <div class="track-needle"></div>
    `;
    row.addEventListener('click', ()=> toggleTrack(row, track));
    list.appendChild(row);
  });
}

function toggleTrack(row, track){
  const isThisPlaying = row.classList.contains('playing');

  // Stop whatever was playing before (only one track at a time,
  // and duck the ambient bgm so the song is heard clearly).
  if(currentPlayingRow) currentPlayingRow.classList.remove('playing');
  trackPlayer.pause();

  if(isThisPlaying){
    currentPlayingRow = null;
    bgm.volume = 1; // restore ambient music
    return;
  }

  bgm.volume = 0.15; // duck ambient bgm while a track plays
  trackPlayer.src = track.src;
  trackPlayer.play().catch(()=> console.warn('Track could not play — src may be a placeholder.'));
  row.classList.add('playing');
  currentPlayingRow = row;
}

trackPlayer.addEventListener('ended', ()=>{
  if(currentPlayingRow) currentPlayingRow.classList.remove('playing');
  currentPlayingRow = null;
  bgm.volume = 1;
});

// ---------- Hall 5: Love Letters ----------
// Fallback sample used until Dashboard's Letter Manager (Step 4)
// lets the creator manage /letters documents with type:'love'.
const FALLBACK_LOVE_LETTERS = [
  { label:'01', content:'Kalau jarak ini punya suara, mungkin bunyinya kayak nada sambung sebelum kamu angkat telepon.' },
  { label:'02', content:'Aku suka gimana kamu masih semangat cerita hal receh walau capek abis kerja/kuliah seharian.' },
  { label:'03', content:'Suatu hari nanti, jarak ini cuma jadi cerita yang kita ketawain bareng.' },
];

async function loadLoveLetters(){
  let letters = FALLBACK_LOVE_LETTERS;
  try{
    const fetched = await fetchAll('letters', 'order');
    const loveOnly = fetched.filter(l => l.type === 'love');
    if(loveOnly.length) letters = loveOnly;
  } catch(err){
    console.warn("Letters collection not ready yet — using fallback love letters.", err);
  }
  renderLoveLetters(letters);
}

function renderLoveLetters(letters){
  const grid = $('#miniEnvelopes');
  grid.innerHTML = '';
  letters.forEach((letter, i)=>{
    const env = document.createElement('div');
    env.className = 'mini-envelope mi-tap';
    env.innerHTML = `<span class="env-label">Surat ${letter.label || String(i+1).padStart(2,'0')}</span>`;
    env.addEventListener('click', ()=>{
      $('#letterModalText').textContent = letter.content || '';
      $('#letterModal').classList.add('visible');
      playSFX('sfxPaper');
    });
    grid.appendChild(env);
  });
}
$('#letterModalClose').addEventListener('click', ()=> $('#letterModal').classList.remove('visible'));
$('#letterModal').addEventListener('click', (e)=>{ if(e.target.id === 'letterModal') e.currentTarget.classList.remove('visible'); });

// ---------- Hall 6: Thank You / Sorry / Final Letter stepper ----------
const stepperStages = ['thanks','sorry','final','quote'];
const stepperTitles = { thanks:'Terima Kasih', sorry:'Maaf', final:'Surat Terakhir', quote:'Penutup' };
let stepperIndex = 0;

function showStepperStage(index){
  const stage = stepperStages[index];
  $all('.stepper-panel').forEach(p => p.classList.toggle('active', p.dataset.stage === stage));
  $all('.stepper-dot').forEach(d => d.classList.toggle('active', d.dataset.stage === stage));
  $('#stepperTitle').textContent = stepperTitles[stage];
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

// ---------- Ending sequence ----------
function triggerEnding(){
  const ending = $('#endingScreen');
  ending.classList.add('active');

  // Fade the ambient music out as the "lights" go down.
  let v = bgm.volume;
  const ambience = $('#sfxAmbience');
  const fadeOut = setInterval(()=>{
    v -= 0.08;
    bgm.volume = Math.max(v, 0);
    if(ambience) ambience.volume = Math.max((ambience.volume||0) - 0.02, 0);
    if(v <= 0){ clearInterval(fadeOut); bgm.pause(); if(ambience) ambience.pause(); }
  }, 120);

  // Lights-off bands switch off one by one (staggered).
  const bands = $all('.lights-off-band');
  bands.forEach((band, i)=> setTimeout(()=> band.classList.add('off'), i * (AppState.reducedMotion ? 50 : 220)));

  const revealDelay = AppState.reducedMotion ? 400 : 1600;
  setTimeout(()=>{
    spawnStars($('#starField'), AppState.reducedMotion ? 20 : 60);
    $('#endingQuote').classList.add('visible');
    setTimeout(()=> $('#visitAgainBtn').classList.add('visible'), 800);
  }, revealDelay);
}

function spawnStars(container, count){
  container.innerHTML = '';
  for(let i=0;i<count;i++){
    const s = document.createElement('div');
    s.className = 'star';
    s.style.left = Math.random()*100 + '%';
    s.style.top = Math.random()*70 + '%';
    s.style.animationDelay = (Math.random()*2) + 's, ' + (Math.random()*3) + 's';
    container.appendChild(s);
  }
}

$('#visitAgainBtn').addEventListener('click', ()=> location.reload());

/** Loads the singleton letters (opening / thankyou / sorry / final /
 * quote) from Firestore and overwrites the hardcoded Hall text with
 * them — so edits made in the Dashboard actually show up for visitors. */
async function loadFixedLetters(){
  const map = {};
  (await fetchAll('letters')).forEach(l => { if(l.type && l.type !== 'love') map[l.type] = l.content; });
  if(map.opening)  $('#hall1LetterText').textContent = map.opening;
  if(map.thankyou) $('#stepperThanksText').textContent = map.thankyou;
  if(map.sorry)    $('#stepperSorryText').textContent = map.sorry;
  if(map.final)    $('#stepperFinalText').textContent = map.final;
  if(map.quote)    $('#stepperQuoteText').textContent = map.quote;
}

export const THEME_PRESETS = {
  'midnight-museum': { label:'Midnight Museum', bg:'#0B0A0C', gold:'#C9A96A', cream:'#EDE6DA' },
  'vintage':          { label:'Vintage',         bg:'#1E1812', gold:'#B8865B', cream:'#EFE3D0' },
  'rose-gold':        { label:'Rose Gold',       bg:'#160F14', gold:'#D9A0A6', cream:'#F3E7E4' },
};
export const FONT_PRESETS = {
  'elegant-serif': { label:'Elegant Serif', value:"'Cormorant Garamond', serif" },
  'typewriter':    { label:'Typewriter',    value:"'IBM Plex Mono', monospace" },
  'modern-sans':   { label:'Modern Sans',   value:"'Inter', sans-serif" },
};

export function applyTheme(themeKey){
  const t = THEME_PRESETS[themeKey] || THEME_PRESETS['midnight-museum'];
  document.documentElement.style.setProperty('--bg', t.bg);
  document.documentElement.style.setProperty('--gold', t.gold);
  document.documentElement.style.setProperty('--cream', t.cream);
}
export function applyFont(fontKey){
  const f = FONT_PRESETS[fontKey] || FONT_PRESETS['elegant-serif'];
  document.documentElement.style.setProperty('--font-display', f.value);
}

// ==========================================================
// 13. LAZY-LOAD IMAGE FADE-IN
// ==========================================================
// The CSS (img[loading="lazy"] -> .loaded) was already in place, but
// nothing ever added the "loaded" class, so every lazy image stayed
// invisible. The 'load' event does not bubble, so this must be
// attached with useCapture:true on a common ancestor (document).
document.addEventListener('load', (e)=>{
  const el = e.target;
  if(el.tagName === 'IMG' && el.hasAttribute('loading')){
    el.classList.add('loaded');
  }
}, true);

/** Some images finish loading from the browser cache before this
 * listener is even attached (e.g. re-rendering a panel that reuses
 * a cached photo), in which case the 'load' event never fires again.
 * Call this right after injecting any lazy <img> markup to catch
 * that case and mark already-complete images as loaded immediately. */
function markCachedImagesLoaded(container){
  container.querySelectorAll('img[loading="lazy"]').forEach(img=>{
    if(img.complete && img.naturalWidth > 0) img.classList.add('loaded');
  });
}

// ==========================================================
// 14. INIT
// ==========================================================
applyMotionPreference();
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyMotionPreference);
spawnDust($('#pinAtmosphere'), 10);
loadConfig().then(()=>{
  if(AppState.config?.theme) applyTheme(AppState.config.theme);
  if(AppState.config?.font) applyFont(AppState.config.font);
  // BUG FIX: these two were saved by the Dashboard (Identity /
  // Appearance panels) but never read back on load, so a Creator's
  // saved museum name / welcome message / forced-reduced-motion
  // setting silently never reached actual visitors.
  applyIdentity();
  if(AppState.config?.forceReducedMotion){
    AppState.reducedMotion = true;
    document.body.classList.add('reduced-motion');
  }
});
