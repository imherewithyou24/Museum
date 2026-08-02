// ==========================================================
// admin.js — everything Creator-only: Inline Edit Mode, opening the
// Dashboard, and the 6 Dashboard managers (Identity, Gallery incl.
// Scrapbook, Letters, Playlist, Appearance, Settings). Imports the
// generic Firestore/Storage helpers from firebase.js and the shared
// visitor-side state/helpers from app.js — never talks to Firebase
// or the DOM query helpers directly.
// ==========================================================
import { fetchAll, addItem, updateItem, deleteItem, setSingleton, uploadFile } from './firebase.js';
import { AppState, $, $all, applyIdentity, enterMuseum, applyTheme, applyFont, THEME_PRESETS, FONT_PRESETS } from './app.js';

// ---------- Inline Edit Mode (Creator only) ----------
// Lets the Creator click straight into museum text and edit it in
// place, Notion/Canva-style. On blur, the new value is written to
// Firestore via the same helpers the Dashboard uses, so this and
// the Dashboard forms always stay in sync.
$('#toggleEditModeBtn').addEventListener('click', (e)=>{
  const btn = e.currentTarget;
  const isEditing = document.body.classList.toggle('edit-mode-active');
  btn.classList.toggle('active', isEditing);
  btn.innerHTML = `Edit Mode: <span>${isEditing ? 'ON' : 'OFF'}</span>`;

  $all('[data-editable]').forEach(el=>{
    el.contentEditable = isEditing;
    el.removeEventListener('blur', handleInlineSave); // avoid stacking duplicate listeners
    if(isEditing) el.addEventListener('blur', handleInlineSave);
  });
});

$('#openDashboardBtn').addEventListener('click', ()=>{
  $('#museum').classList.remove('active');
  $('#dashboard').classList.add('active');
  wireDashboardNav();
});

/** BUG FIX (reported): "Preview as Girlfriend" had no click handler.
 * Closes the Dashboard, force-quits Edit Mode (so nothing is left
 * contentEditable underneath), and drops the Creator back into the
 * museum exactly as a visitor would see it. */
$('#previewMuseumBtn').addEventListener('click', ()=>{
  $('#dashboard').classList.remove('active');

  if(document.body.classList.contains('edit-mode-active')){
    document.body.classList.remove('edit-mode-active');
    const editBtn = $('#toggleEditModeBtn');
    editBtn.classList.remove('active');
    editBtn.innerHTML = `Edit Mode: <span>OFF</span>`;
    $all('[data-editable]').forEach(el=>{
      el.contentEditable = false;
      el.removeEventListener('blur', handleInlineSave);
    });
  }

  enterMuseum();
});

function flashEditSavePill(text){
  const pill = $('#editSavePill');
  pill.textContent = text;
  pill.classList.add('visible');
  setTimeout(()=> pill.classList.remove('visible'), 1400);
}

/** Fires on blur of any [data-editable] element while Edit Mode is
 * on. Field keys look like "letters.opening" (writes into the same
 * singleton doc the Letters Manager uses) or "museum.hall2_title"
 * (writes into a general /content/site doc). */
async function handleInlineSave(e){
  const el = e.target;
  const newValue = el.innerText.trim();
  const fieldKey = el.dataset.editable;
  if(!fieldKey) return;

  try{
    if(fieldKey.startsWith('letters.')){
      const type = fieldKey.split('.')[1];
      await setSingleton('letters', type, { type, content: newValue });
    } else {
      await setSingleton('content', 'site', { [fieldKey]: newValue });
    }
    flashEditSavePill('Tersimpan');
  } catch(err){
    console.error('Inline autosave failed:', err);
    flashEditSavePill('Gagal menyimpan');
  }
}

// ==========================================================
// CREATOR DASHBOARD — 5 MANAGERS (data layer lives in firebase.js)
// ==========================================================

/** Brief, honest status flash next to the dashboard title.
 * There is no separate draft/publish pipeline — every save here
 * writes straight to Firestore/Storage, so this just reflects that. */
function flashSaveStatus(text, isError){
  const el = $('#dashSaveStatus');
  el.textContent = text;
  el.classList.toggle('err', !!isError);
  el.classList.toggle('ok', !isError);
  if(!isError){
    setTimeout(()=>{ el.textContent = 'Tersimpan otomatis'; }, 1800);
  }
}

/** Swaps the `order` field between two already-fetched items and
 * persists both — used by the ↑/↓ reorder buttons. */
async function swapOrder(collectionName, items, indexA, indexB){
  if(indexB < 0 || indexB >= items.length) return;
  const a = items[indexA], b = items[indexB];
  const orderA = a.order, orderB = b.order;
  await updateItem(collectionName, a.id, { order: orderB });
  await updateItem(collectionName, b.id, { order: orderA });
}

// ---------- Identity Manager ----------
async function renderIdentityPanel(){
  const content = $('#dashContent');
  const current = AppState.config || {};
  content.innerHTML = `
    <p class="dash-panel-title">Museum Identity</p>
    <p class="dash-panel-desc">Nama, pesan sambutan, dan foto latar layar PIN</p>
    <div class="dash-card">
      <div class="dash-field"><label>Nama Museum</label>
        <input type="text" id="idMuseumName" value="${(current.museumName || 'Our Little Museum').replace(/"/g,'&quot;')}">
      </div>
      <div class="dash-field"><label>Pesan Sambutan (di layar PIN)</label>
        <textarea id="idWelcomeMsg" rows="2">${current.welcomeMsg || 'Museum ini hanya terbuka untuk pengunjung dengan undangan khusus.'}</textarea>
      </div>
      <div class="dash-field">
        <label>Foto Latar Layar PIN (opsional)</label>
        ${current.bgImage ? `<img class="dash-thumb" style="width:100%; height:110px; margin-bottom:8px;" src="${current.bgImage}" alt="">` : ''}
        <input type="file" id="idBgFile" accept="image/*">
      </div>
      <button class="dash-btn" id="saveIdentityBtn">Simpan Identitas</button>
    </div>
  `;

  $('#saveIdentityBtn').addEventListener('click', async (e)=>{
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    try{
      const museumName = $('#idMuseumName').value.trim() || 'Our Little Museum';
      const welcomeMsg = $('#idWelcomeMsg').value.trim();
      const payload = { museumName, welcomeMsg };

      const file = $('#idBgFile').files[0];
      if(file){
        payload.bgImage = await uploadFile(file, 'identity');
      }

      await setSingleton('config', 'settings', payload);
      AppState.config = { ...AppState.config, ...payload };
      applyIdentity();
      flashSaveStatus('Identitas tersimpan');
      renderIdentityPanel(); // refresh so the new background thumbnail shows
    } catch(err){
      console.error('Failed to save identity:', err);
      flashSaveStatus('Gagal menyimpan', true);
      btn.disabled = false; btn.textContent = 'Simpan Identitas';
    }
  });
}

// ---------- Gallery Manager (+ Scrapbook, folded in — no separate menu) ----------
async function renderGalleryPanel(){
  const content = $('#dashContent');
  content.innerHTML = `
    <p class="dash-panel-title">Gallery Manager</p>
    <p class="dash-panel-desc">Foto-foto Hall 2 &middot; Memory Gallery</p>
    <div id="galleryList"></div>
    <div class="dash-card">
      <label class="dash-field"><label>Tambah Foto</label></label>
      <div class="dash-field"><label>File Foto</label><input type="file" id="newPhotoFile" accept="image/*"></div>
      <div class="dash-field"><label>Caption</label><input type="text" id="newPhotoCaption" placeholder="Panggilan video pertama"></div>
      <div class="dash-field"><label>Cerita</label><textarea id="newPhotoStory" rows="2" placeholder="Ceritakan momen ini..."></textarea></div>
      <button class="dash-btn" id="addPhotoBtn">+ Tambah Foto</button>
    </div>

    <div class="dash-section-divider"></div>
    <p class="dash-panel-title" style="font-size:16px;">Scrapbook Items</p>
    <p class="dash-panel-desc">Polaroid, catatan, tape &amp; sticker di Hall 3</p>
    <div id="scrapList"></div>
    <div class="dash-card">
      <div class="dash-field"><label>Jenis</label>
        <select id="newScrapType" style="width:100%; background:var(--bg-panel); border:1px solid var(--line); color:var(--cream); padding:10px 12px; border-radius:6px;">
          <option value="polaroid">Polaroid (foto)</option>
          <option value="note">Note (tulisan)</option>
          <option value="tape">Tape (dekorasi)</option>
          <option value="sticker">Sticker (emoji)</option>
        </select>
      </div>
      <div class="dash-field" id="scrapExtraField"><label>Foto</label><input type="file" id="newScrapFile" accept="image/*"></div>
      <div class="dash-btn-row">
        <div class="dash-field" style="flex:1;"><label>Posisi X</label><input type="text" id="newScrapX" value="20%"></div>
        <div class="dash-field" style="flex:1;"><label>Posisi Y</label><input type="text" id="newScrapY" value="20%"></div>
      </div>
      <button class="dash-btn" id="addScrapBtn">+ Tambah Item</button>
    </div>
  `;

  $('#newScrapType').addEventListener('change', (e)=>{
    const extra = $('#scrapExtraField');
    if(e.target.value === 'polaroid'){
      extra.innerHTML = '<label>Foto</label><input type="file" id="newScrapFile" accept="image/*">';
    } else if(e.target.value === 'note'){
      extra.innerHTML = '<label>Teks Catatan</label><input type="text" id="newScrapText" placeholder="jangan lupa makan ya">';
    } else if(e.target.value === 'sticker'){
      extra.innerHTML = '<label>Emoji</label><input type="text" id="newScrapText" value="🌙" maxlength="4">';
    } else {
      extra.innerHTML = '';
    }
  });

  async function refreshGalleryList(){
    const items = await fetchAll('gallery', 'order');
    const list = $('#galleryList');
    list.innerHTML = items.length ? '' : '<p class="dash-panel-desc">Belum ada foto.</p>';
    items.forEach((item, i)=>{
      const card = document.createElement('div');
      card.className = 'dash-card';
      card.innerHTML = `
        <div class="dash-card-row">
          <img class="dash-thumb" src="${item.src||''}" alt="">
          <div style="flex:1;">
            <div class="dash-field"><label>Caption</label><input type="text" value="${(item.caption||'').replace(/"/g,'&quot;')}" data-field="caption"></div>
            <div class="dash-field"><label>Cerita</label><textarea rows="2" data-field="story">${item.story||''}</textarea></div>
            <div class="dash-btn-row">
              <button class="dash-btn ghost" data-act="up">↑</button>
              <button class="dash-btn ghost" data-act="down">↓</button>
              <button class="dash-btn" data-act="save">Simpan</button>
              <button class="dash-btn danger" data-act="delete">Hapus</button>
            </div>
          </div>
        </div>`;
      card.querySelector('[data-act="save"]').addEventListener('click', async ()=>{
        const caption = card.querySelector('[data-field="caption"]').value;
        const story = card.querySelector('[data-field="story"]').value;
        await updateItem('gallery', item.id, { caption, story });
        flashSaveStatus('Tersimpan');
      });
      card.querySelector('[data-act="delete"]').addEventListener('click', async ()=>{
        await deleteItem('gallery', item.id);
        flashSaveStatus('Foto dihapus');
        refreshGalleryList();
      });
      card.querySelector('[data-act="up"]').addEventListener('click', async ()=>{ await swapOrder('gallery', items, i, i-1); refreshGalleryList(); });
      card.querySelector('[data-act="down"]').addEventListener('click', async ()=>{ await swapOrder('gallery', items, i, i+1); refreshGalleryList(); });
      list.appendChild(card);
    });
  }

  $('#addPhotoBtn').addEventListener('click', async (e)=>{
    const file = $('#newPhotoFile').files[0];
    if(!file){ flashSaveStatus('Pilih file foto dulu', true); return; }
    const btn = e.currentTarget;
    btn.disabled = true; // guards against double-submit while the upload is in flight
    flashSaveStatus('Mengunggah...');
    try{
      const src = await uploadFile(file, 'gallery');
      const existing = await fetchAll('gallery', 'order');
      await addItem('gallery', {
        src, caption: $('#newPhotoCaption').value, story: $('#newPhotoStory').value,
        order: existing.length
      });
      $('#newPhotoCaption').value = ''; $('#newPhotoStory').value = ''; $('#newPhotoFile').value = '';
      flashSaveStatus('Foto ditambahkan');
      refreshGalleryList();
    } catch(err){ console.error(err); flashSaveStatus('Gagal mengunggah', true); }
    finally{ btn.disabled = false; }
  });

  async function refreshScrapList(){
    const items = await fetchAll('scrapbook', 'order');
    const list = $('#scrapList');
    list.innerHTML = items.length ? '' : '<p class="dash-panel-desc">Belum ada item scrapbook.</p>';
    items.forEach((item, i)=>{
      const card = document.createElement('div');
      card.className = 'dash-card';
      card.innerHTML = `
        <p class="dash-status">${item.type}</p>
        <div class="dash-btn-row">
          <button class="dash-btn ghost" data-act="up">↑</button>
          <button class="dash-btn ghost" data-act="down">↓</button>
          <button class="dash-btn danger" data-act="delete">Hapus</button>
        </div>`;
      card.querySelector('[data-act="delete"]').addEventListener('click', async ()=>{
        await deleteItem('scrapbook', item.id);
        flashSaveStatus('Item dihapus');
        refreshScrapList();
      });
      card.querySelector('[data-act="up"]').addEventListener('click', async ()=>{ await swapOrder('scrapbook', items, i, i-1); refreshScrapList(); });
      card.querySelector('[data-act="down"]').addEventListener('click', async ()=>{ await swapOrder('scrapbook', items, i, i+1); refreshScrapList(); });
      list.appendChild(card);
    });
  }

  $('#addScrapBtn').addEventListener('click', async (e)=>{
    const type = $('#newScrapType').value;
    const btn = e.currentTarget;
    btn.disabled = true;
    try{
      const existing = await fetchAll('scrapbook', 'order');
      const base = { type, x: $('#newScrapX').value, y: $('#newScrapY').value, rotate: Math.round(Math.random()*12-6), order: existing.length };
      if(type === 'polaroid'){
        const file = $('#newScrapFile').files[0];
        if(!file){ flashSaveStatus('Pilih file foto dulu', true); return; }
        flashSaveStatus('Mengunggah...');
        base.src = await uploadFile(file, 'scrapbook');
      } else if(type === 'note'){
        base.text = $('#newScrapText').value;
      } else if(type === 'sticker'){
        base.emoji = $('#newScrapText').value;
      }
      await addItem('scrapbook', base);
      flashSaveStatus('Item ditambahkan');
      refreshScrapList();
    } catch(err){ console.error(err); flashSaveStatus('Gagal menambah item', true); }
    finally{ btn.disabled = false; }
  });

  refreshGalleryList();
  refreshScrapList();
}

// ---------- Letters Manager ----------
async function renderLettersPanel(){
  const content = $('#dashContent');
  content.innerHTML = `
    <p class="dash-panel-title">Letters Manager</p>
    <p class="dash-panel-desc">Opening, Thank You, Sorry, Final Letter &amp; Penutup (satu isi tetap per Hall)</p>
    <div id="fixedLettersForm"></div>

    <div class="dash-section-divider"></div>
    <p class="dash-panel-title" style="font-size:16px;">Love Letters (Hall 5)</p>
    <p class="dash-panel-desc">Amplop kecil, bisa lebih dari satu</p>
    <div id="loveLettersList"></div>
    <div class="dash-card">
      <div class="dash-field"><label>Isi Surat Baru</label><textarea id="newLoveContent" rows="3" placeholder="Tulis surat cinta baru..."></textarea></div>
      <button class="dash-btn" id="addLoveBtn">+ Tambah Surat</button>
    </div>
  `;

  const fixedTypes = [
    { type:'opening',  label:'Hall 1 — Opening Letter', el:'hall1LetterText' },
    { type:'thankyou', label:'Hall 6 — Thank You',      el:'stepperThanksText' },
    { type:'sorry',    label:'Hall 6 — Sorry',          el:'stepperSorryText' },
    { type:'final',    label:'Hall 6 — Final Letter',   el:'stepperFinalText' },
    { type:'quote',    label:'Hall 6 — Penutup',        el:'stepperQuoteText' },
  ];

  const allLetters = await fetchAll('letters');
  const form = $('#fixedLettersForm');
  fixedTypes.forEach(f=>{
    const existing = allLetters.find(l => l.type === f.type);
    const wrap = document.createElement('div');
    wrap.className = 'dash-card';
    wrap.innerHTML = `
      <div class="dash-field"><label>${f.label}</label>
        <textarea rows="3" data-type="${f.type}">${existing ? existing.content : document.getElementById(f.el).textContent}</textarea>
      </div>
      <button class="dash-btn" data-save="${f.type}">Simpan</button>
    `;
    wrap.querySelector('button').addEventListener('click', async ()=>{
      const text = wrap.querySelector('textarea').value;
      await setSingleton('letters', f.type, { type: f.type, content: text });
      document.getElementById(f.el).textContent = text;
      flashSaveStatus('Tersimpan');
    });
    form.appendChild(wrap);
  });

  async function refreshLoveLetters(){
    const items = (await fetchAll('letters', 'order')).filter(l => l.type === 'love');
    const list = $('#loveLettersList');
    list.innerHTML = items.length ? '' : '<p class="dash-panel-desc">Belum ada love letter.</p>';
    items.forEach(item=>{
      const card = document.createElement('div');
      card.className = 'dash-card';
      card.innerHTML = `
        <div class="dash-field"><textarea rows="2" data-field="content">${item.content||''}</textarea></div>
        <div class="dash-btn-row">
          <button class="dash-btn" data-act="save">Simpan</button>
          <button class="dash-btn danger" data-act="delete">Hapus</button>
        </div>`;
      card.querySelector('[data-act="save"]').addEventListener('click', async ()=>{
        await updateItem('letters', item.id, { content: card.querySelector('[data-field="content"]').value });
        flashSaveStatus('Tersimpan');
      });
      card.querySelector('[data-act="delete"]').addEventListener('click', async ()=>{
        await deleteItem('letters', item.id);
        flashSaveStatus('Surat dihapus');
        refreshLoveLetters();
      });
      list.appendChild(card);
    });
  }

  $('#addLoveBtn').addEventListener('click', async (e)=>{
    const content = $('#newLoveContent').value.trim();
    if(!content){ flashSaveStatus('Isi surat dulu', true); return; }
    const btn = e.currentTarget;
    btn.disabled = true;
    try{
      const existing = (await fetchAll('letters', 'order')).filter(l => l.type === 'love');
      await addItem('letters', { type:'love', content, order: existing.length, label: String(existing.length+1).padStart(2,'0') });
      $('#newLoveContent').value = '';
      flashSaveStatus('Surat ditambahkan');
      refreshLoveLetters();
    } catch(err){ console.error(err); flashSaveStatus('Gagal menambah surat', true); }
    finally{ btn.disabled = false; }
  });

  refreshLoveLetters();
}

// ---------- Playlist Manager ----------
async function renderPlaylistPanel(){
  const content = $('#dashContent');
  content.innerHTML = `
    <p class="dash-panel-title">Playlist Manager</p>
    <p class="dash-panel-desc">Lagu-lagu di Hall 4 &middot; Our Playlist</p>
    <div id="playlistManagerList"></div>
    <div class="dash-card">
      <div class="dash-field"><label>Judul Lagu</label><input type="text" id="newTrackTitle" placeholder="Judul"></div>
      <div class="dash-field"><label>Artis</label><input type="text" id="newTrackArtist" placeholder="Nama artis"></div>
      <div class="dash-field"><label>Alasan Lagu Ini Penting</label><textarea id="newTrackReason" rows="2"></textarea></div>
      <div class="dash-field"><label>File MP3 (atau kosongkan &amp; isi link di bawah)</label><input type="file" id="newTrackFile" accept="audio/mpeg"></div>
      <div class="dash-field"><label>Link MP3 / Spotify (alternatif upload)</label><input type="text" id="newTrackUrl" placeholder="https://..."></div>
      <div class="dash-field"><label>Cover (opsional)</label><input type="file" id="newTrackCover" accept="image/*"></div>
      <button class="dash-btn" id="addTrackBtn">+ Tambah Lagu</button>
    </div>
  `;

  async function refreshList(){
    const items = await fetchAll('playlist', 'order');
    const list = $('#playlistManagerList');
    list.innerHTML = items.length ? '' : '<p class="dash-panel-desc">Belum ada lagu.</p>';
    items.forEach((item, i)=>{
      const card = document.createElement('div');
      card.className = 'dash-card';
      card.innerHTML = `
        <div class="dash-field"><label>Judul</label><input type="text" value="${(item.title||'').replace(/"/g,'&quot;')}" data-field="title"></div>
        <div class="dash-field"><label>Artis</label><input type="text" value="${(item.artist||'').replace(/"/g,'&quot;')}" data-field="artist"></div>
        <div class="dash-field"><label>Alasan</label><textarea rows="2" data-field="reason">${item.reason||''}</textarea></div>
        <div class="dash-btn-row">
          <button class="dash-btn ghost" data-act="up">↑</button>
          <button class="dash-btn ghost" data-act="down">↓</button>
          <button class="dash-btn" data-act="save">Simpan</button>
          <button class="dash-btn danger" data-act="delete">Hapus</button>
        </div>`;
      card.querySelector('[data-act="save"]').addEventListener('click', async ()=>{
        await updateItem('playlist', item.id, {
          title: card.querySelector('[data-field="title"]').value,
          artist: card.querySelector('[data-field="artist"]').value,
          reason: card.querySelector('[data-field="reason"]').value,
        });
        flashSaveStatus('Tersimpan');
      });
      card.querySelector('[data-act="delete"]').addEventListener('click', async ()=>{
        await deleteItem('playlist', item.id);
        flashSaveStatus('Lagu dihapus');
        refreshList();
      });
      card.querySelector('[data-act="up"]').addEventListener('click', async ()=>{ await swapOrder('playlist', items, i, i-1); refreshList(); });
      card.querySelector('[data-act="down"]').addEventListener('click', async ()=>{ await swapOrder('playlist', items, i, i+1); refreshList(); });
      list.appendChild(card);
    });
  }

  $('#addTrackBtn').addEventListener('click', async (e)=>{
    const title = $('#newTrackTitle').value.trim();
    if(!title){ flashSaveStatus('Isi judul lagu dulu', true); return; }
    const btn = e.currentTarget;
    btn.disabled = true;
    flashSaveStatus('Menyimpan...');
    try{
      let src = $('#newTrackUrl').value.trim();
      const file = $('#newTrackFile').files[0];
      if(file) src = await uploadFile(file, 'playlist');

      let cover = '';
      const coverFile = $('#newTrackCover').files[0];
      if(coverFile) cover = await uploadFile(coverFile, 'playlist-covers');

      const existing = await fetchAll('playlist', 'order');
      await addItem('playlist', {
        title, artist: $('#newTrackArtist').value, reason: $('#newTrackReason').value,
        src, cover, order: existing.length
      });
      $('#newTrackTitle').value=''; $('#newTrackArtist').value=''; $('#newTrackReason').value='';
      $('#newTrackUrl').value=''; $('#newTrackFile').value=''; $('#newTrackCover').value='';
      flashSaveStatus('Lagu ditambahkan');
      refreshList();
    } catch(err){ console.error(err); flashSaveStatus('Gagal menambah lagu', true); }
    finally{ btn.disabled = false; }
  });

  refreshList();
}


// ---------- Appearance Manager ----------
async function renderAppearancePanel(){
  const content = $('#dashContent');
  const current = AppState.config || {};
  content.innerHTML = `
    <p class="dash-panel-title">Appearance</p>
    <p class="dash-panel-desc">Theme, font, dan animasi museum</p>

    <div class="dash-field"><label>Theme</label></div>
    <div class="theme-swatch-row" id="themeSwatches"></div>

    <div class="dash-section-divider"></div>
    <div class="dash-field"><label>Font Judul</label></div>
    <div class="dash-tabs" id="fontTabs"></div>

    <div class="dash-section-divider"></div>
    <div class="dash-field">
      <label><input type="checkbox" id="forceReducedMotion" ${current.forceReducedMotion ? 'checked' : ''}> Matikan animasi berat (mode hemat baterai / motion-sensitive)</label>
    </div>
    <button class="dash-btn" id="saveAppearanceBtn">Simpan Appearance</button>
  `;

  const swatchWrap = $('#themeSwatches');
  Object.entries(THEME_PRESETS).forEach(([key, t])=>{
    const el = document.createElement('div');
    el.className = 'theme-swatch' + (current.theme === key ? ' active' : '');
    el.dataset.theme = key;
    el.innerHTML = `<div class="swatch-dot" style="background:${t.gold};"></div>${t.label}`;
    el.addEventListener('click', ()=>{
      $all('.theme-swatch').forEach(s=>s.classList.remove('active'));
      el.classList.add('active');
      applyTheme(key);
    });
    swatchWrap.appendChild(el);
  });

  const fontWrap = $('#fontTabs');
  Object.entries(FONT_PRESETS).forEach(([key, f])=>{
    const el = document.createElement('div');
    el.className = 'dash-tab' + (current.font === key ? ' active' : '');
    el.dataset.font = key;
    el.textContent = f.label;
    el.addEventListener('click', ()=>{
      $all('.dash-tab').forEach(t=>t.classList.remove('active'));
      el.classList.add('active');
      applyFont(key);
    });
    fontWrap.appendChild(el);
  });

  $('#saveAppearanceBtn').addEventListener('click', async ()=>{
    const theme = document.querySelector('.theme-swatch.active')?.dataset.theme || 'midnight-museum';
    const font = document.querySelector('.dash-tab.active')?.dataset.font || 'elegant-serif';
    const forceReducedMotion = $('#forceReducedMotion').checked;
    await setSingleton('config', 'settings', { theme, font, forceReducedMotion });
    AppState.config = { ...AppState.config, theme, font, forceReducedMotion };
    document.body.classList.toggle('reduced-motion', forceReducedMotion || AppState.reducedMotion);
    flashSaveStatus('Appearance tersimpan');
  });
}

// ---------- Settings Manager ----------
async function renderSettingsPanel(){
  const content = $('#dashContent');
  const current = AppState.config || {};
  content.innerHTML = `
    <p class="dash-panel-title">Settings</p>
    <p class="dash-panel-desc">PIN akses &mdash; disimpan langsung ke Firestore, berlaku seketika untuk kunjungan berikutnya</p>
    <div class="dash-field"><label>Visitor PIN</label><input type="text" id="visitorPinInput" maxlength="4" value="${current.visitorPin || ''}"></div>
    <div class="dash-field"><label>Creator PIN</label><input type="text" id="creatorPinInput" maxlength="4" value="${current.creatorPin || ''}"></div>
    <button class="dash-btn" id="savePinBtn">Simpan PIN</button>
    <div class="dash-section-divider"></div>
    <p class="dash-panel-desc">Catatan jujur: museum ini tidak punya mode draft/publish terpisah — semua perubahan di Dashboard langsung tersimpan dan langsung terlihat oleh pengunjung berikutnya.</p>
  `;
  $('#savePinBtn').addEventListener('click', async ()=>{
    const visitorPin = $('#visitorPinInput').value.trim();
    const creatorPin = $('#creatorPinInput').value.trim();
    if(visitorPin.length !== 4 || creatorPin.length !== 4){
      flashSaveStatus('PIN harus 4 digit', true); return;
    }
    await setSingleton('config', 'settings', { visitorPin, creatorPin });
    AppState.config = { ...AppState.config, visitorPin, creatorPin };
    flashSaveStatus('PIN tersimpan');
  });
}

// ==========================================================
// 12. DASHBOARD NAV (simplified 5-menu shell)
// ==========================================================
let dashboardNavWired = false;
function wireDashboardNav(){
  const items = $all('.dash-nav-item');
  const renderers = {
    identity: renderIdentityPanel,
    gallery: renderGalleryPanel,
    letters: renderLettersPanel,
    playlist: renderPlaylistPanel,
    appearance: renderAppearancePanel,
    settings: renderSettingsPanel,
  };
  if(!dashboardNavWired){
    items.forEach(item=>{
      item.addEventListener('click', ()=>{
        items.forEach(i=>i.classList.remove('active'));
        item.classList.add('active');
        renderers[item.dataset.panel]();
      });
    });
    dashboardNavWired = true;
  }
  renderGalleryPanel(); // default panel whenever the dashboard is opened
}

