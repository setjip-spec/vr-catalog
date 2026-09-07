(() => {
  'use strict';

  const SUPABASE_URL = 'https://lepvlmclsbciwvhxyktf.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_V_s6ONo_RtLR3sR96asPJw_M92v98vR';
  const APP_ID = 'APP-002';
  const CLOUD_SCHEMA_VERSION = 1;
  const SAVE_DELAY_MS = 800;

  let client = null;
  let cloudUser = null;
  let cloudRevision = 0;
  let cloudReady = false;
  let cloudApplying = false;
  let saveTimer = null;
  let lastSavedSignature = '';
  let migrationPending = false;
  let legacyPersonalDataDetectedAtBoot = false;

  const clone = value => JSON.parse(JSON.stringify(value));
  const signature = value => JSON.stringify(value);

  function injectCloudUi() {
    const style = document.createElement('style');
    style.textContent = `
      .vr-cloud-gate{position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(244,246,248,.97);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
      .vr-cloud-gate.open{display:flex}
      .vr-cloud-card{width:min(420px,100%);background:#fff;border:1px solid #d7dce2;border-radius:16px;padding:24px;box-shadow:0 18px 55px rgba(0,0,0,.10);box-sizing:border-box}
      .vr-cloud-card h2{margin:0 0 6px;font-size:24px}.vr-cloud-card p{margin:0 0 18px;color:#68707a;font-size:13px;line-height:1.45}
      .vr-cloud-field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}.vr-cloud-field label{font-size:12px;font-weight:700;color:#5f6670}
      .vr-cloud-field input{width:100%;box-sizing:border-box;border:1px solid #cfd5dc;border-radius:9px;padding:11px 12px;font:inherit;background:#fff}
      .vr-cloud-card button{width:100%;border:0;border-radius:9px;padding:11px 14px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}.vr-cloud-card button:disabled{opacity:.55}
      .vr-cloud-error{min-height:20px;margin:8px 0;color:#b42318;font-size:12px}
      .vr-cloud-badge{position:fixed;right:14px;bottom:14px;z-index:9998;display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #d7dce2;border-radius:10px;background:rgba(255,255,255,.96);box-shadow:0 4px 18px rgba(0,0,0,.08);font:11px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#59616b}
      .vr-cloud-badge[hidden]{display:none}.vr-cloud-badge button{border:0;background:transparent;color:#2563eb;font-weight:700;cursor:pointer;padding:3px}
      .vr-cloud-loading{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9997;padding:7px 11px;border:1px solid #d7dce2;border-radius:999px;background:rgba(255,255,255,.95);font:11px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#68707a;box-shadow:0 3px 14px rgba(0,0,0,.06)}
      .vr-cloud-loading[hidden]{display:none}
    `;
    document.head.appendChild(style);

    const gate = document.createElement('div');
    gate.className = 'vr-cloud-gate';
    gate.id = 'vrCloudGate';
    gate.innerHTML = `
      <form class="vr-cloud-card" id="vrCloudForm">
        <h2>VR Каталог</h2>
        <p>Войдите в общий профиль MINI-APPS-CLOUD. Статусы, комментарии, сохранённые виды и настройки будут синхронизироваться между компьютером и телефоном.</p>
        <div class="vr-cloud-field"><label>Email</label><input name="email" type="email" autocomplete="username" required></div>
        <div class="vr-cloud-field"><label>Пароль</label><input name="password" type="password" autocomplete="current-password" required></div>
        <div class="vr-cloud-error" id="vrCloudError"></div>
        <button type="submit">Войти</button>
      </form>`;
    document.body.appendChild(gate);

    const badge = document.createElement('div');
    badge.className = 'vr-cloud-badge';
    badge.id = 'vrCloudBadge';
    badge.hidden = true;
    badge.innerHTML = '<span id="vrCloudEmail"></span><span>· облако</span><button type="button" id="vrCloudLogout">Выйти</button>';
    document.body.appendChild(badge);

    const loading = document.createElement('div');
    loading.className = 'vr-cloud-loading';
    loading.id = 'vrCloudLoading';
    loading.textContent = 'Синхронизация…';
    loading.hidden = true;
    document.body.appendChild(loading);
  }

  function showLoading(value) {
    const el = document.getElementById('vrCloudLoading');
    if (el) el.hidden = !value;
  }

  function showGate(message = '') {
    const gate = document.getElementById('vrCloudGate');
    if (gate) gate.classList.add('open');
    const err = document.getElementById('vrCloudError');
    if (err) err.textContent = message;
    const badge = document.getElementById('vrCloudBadge');
    if (badge) badge.hidden = true;
  }

  function hideGate() {
    document.getElementById('vrCloudGate')?.classList.remove('open');
    const badge = document.getElementById('vrCloudBadge');
    if (badge) badge.hidden = false;
    const email = document.getElementById('vrCloudEmail');
    if (email) email.textContent = cloudUser?.email || 'Выполнен вход';
  }

  function exportCurrentState() {
    return {
      app: { title: 'VR Каталог', version: '0.1', runtime: 'github-pages+supabase' },
      edits: clone(typeof edits === 'object' && edits ? edits : {}),
      views: clone(typeof views === 'object' && views ? views : {}),
      filterState: clone(typeof state === 'object' && state ? state : {}),
      meta: {
        schemaVersion: CLOUD_SCHEMA_VERSION,
        repository: 'https://github.com/setjip-spec/vr-catalog',
        liveUrl: 'https://setjip-spec.github.io/vr-catalog/'
      }
    };
  }

  function hasOwnData(value) {
    return value && typeof value === 'object' && Object.keys(value).length > 0;
  }

  function detectLegacyPersonalData() {
    return hasOwnData(typeof edits === 'object' && edits ? edits : {}) || hasOwnData(typeof views === 'object' && views ? views : {});
  }

  function applyCloudState(cloudState, firstMigration = false) {
    const localEdits = clone(typeof edits === 'object' && edits ? edits : {});
    const localViews = clone(typeof views === 'object' && views ? views : {});
    const localFilter = clone(typeof state === 'object' && state ? state : {});
    const hasHashState = /(?:^|[#&])state=/.test(location.hash);

    let nextEdits = clone(cloudState?.edits || {});
    let nextViews = clone(cloudState?.views || {});
    let nextFilter = clone(cloudState?.filterState || {});

    if (firstMigration) {
      nextEdits = Object.assign({}, nextEdits, localEdits);
      nextViews = Object.assign({}, nextViews, localViews);
      nextFilter = Object.assign({}, nextFilter, localFilter);
    }

    cloudApplying = true;
    edits = nextEdits;
    views = nextViews;
    if (!hasHashState && hasOwnData(nextFilter)) state = Object.assign(state, nextFilter);

    try {
      localStorage.setItem(EDIT_KEY, JSON.stringify(edits));
      localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
      localStorage.setItem(FILTER_KEY, JSON.stringify(state));
    } catch (_) {}

    init();
    cols();
    loadViews();
    render();
    cloudApplying = false;
  }

  async function loadCloudRow() {
    const { data, error } = await client
      .from('mini_app_state')
      .select('state,revision,schema_version')
      .eq('app_id', APP_ID)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function createCloudRow(payload) {
    const { data, error } = await client
      .from('mini_app_state')
      .insert({
        user_id: cloudUser.id,
        app_id: APP_ID,
        schema_version: CLOUD_SCHEMA_VERSION,
        revision: 1,
        state: payload
      })
      .select('revision')
      .single();
    if (error) throw error;
    cloudRevision = Number(data.revision) || 1;
  }

  async function persistNow(retry = true) {
    if (!cloudReady || !cloudUser || cloudApplying) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    const payload = exportCurrentState();
    payload.meta.localMigrationDone = migrationPending ? legacyPersonalDataDetectedAtBoot : true;
    const sig = signature(payload);
    if (sig === lastSavedSignature) return;

    const nextRevision = cloudRevision + 1;
    showLoading(true);
    try {
      const { data, error } = await client
        .from('mini_app_state')
        .update({
          state: payload,
          schema_version: CLOUD_SCHEMA_VERSION,
          revision: nextRevision,
          updated_at: new Date().toISOString()
        })
        .eq('app_id', APP_ID)
        .eq('revision', cloudRevision)
        .select('revision')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        if (!retry) throw new Error('Конфликт облачной версии');
        const fresh = await loadCloudRow();
        cloudRevision = Number(fresh?.revision) || 0;
        return persistNow(false);
      }
      cloudRevision = Number(data.revision) || nextRevision;
      lastSavedSignature = sig;
      if (payload.meta.localMigrationDone) migrationPending = false;
    } catch (error) {
      console.error('VR Catalog cloud save error:', error);
    } finally {
      showLoading(false);
    }
  }

  function scheduleSave() {
    if (!cloudReady || cloudApplying) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persistNow(true), SAVE_DELAY_MS);
  }

  function installSaveHooks() {
    const originalSaveJSON = saveJSON;
    saveJSON = function(key, value) {
      originalSaveJSON(key, value);
      if ([FILTER_KEY, EDIT_KEY, VIEWS_KEY].includes(key)) scheduleSave();
    };

    const originalPersist = persist;
    persist = function() {
      originalPersist();
      scheduleSave();
    };
  }

  async function startForSession(session) {
    cloudUser = session.user;
    hideGate();
    showLoading(true);
    try {
      let row = await loadCloudRow();
      if (!row) {
        const localPayload = exportCurrentState();
        localPayload.meta.localMigrationDone = legacyPersonalDataDetectedAtBoot;
        await createCloudRow(localPayload);
        migrationPending = !localPayload.meta.localMigrationDone;
        lastSavedSignature = signature(localPayload);
      } else {
        cloudRevision = Number(row.revision) || 0;
        const remote = row.state || {};
        const firstMigration = !remote?.meta?.localMigrationDone;
        migrationPending = firstMigration;
        applyCloudState(remote, firstMigration);
        cloudReady = true;
        if (firstMigration && legacyPersonalDataDetectedAtBoot) await persistNow(true);
        else lastSavedSignature = signature(exportCurrentState());
      }
      cloudReady = true;
    } catch (error) {
      console.error('VR Catalog cloud load error:', error);
      showGate('Не удалось загрузить облачные данные: ' + (error?.message || error));
      return;
    } finally {
      showLoading(false);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const errorBox = document.getElementById('vrCloudError');
    button.disabled = true;
    errorBox.textContent = '';
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: form.email.value.trim(),
        password: form.password.value
      });
      if (error) throw error;
      await startForSession(data.session);
    } catch (error) {
      errorBox.textContent = error?.message || String(error);
    } finally {
      button.disabled = false;
    }
  }

  async function signOut() {
    clearTimeout(saveTimer);
    if (cloudReady) await persistNow(true);
    await client.auth.signOut();
    cloudUser = null;
    cloudReady = false;
    cloudRevision = 0;
    showGate();
  }

  async function boot() {
    injectCloudUi();
    legacyPersonalDataDetectedAtBoot = detectLegacyPersonalData();
    if (!window.supabase?.createClient) {
      showGate('Не загрузилась библиотека Supabase. Обновите страницу и проверьте интернет.');
      return;
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    installSaveHooks();
    document.getElementById('vrCloudForm').addEventListener('submit', signIn);
    document.getElementById('vrCloudLogout').addEventListener('click', signOut);

    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
      showGate(error.message || String(error));
      return;
    }
    if (session) await startForSession(session);
    else showGate();
  }

  boot();
})();
