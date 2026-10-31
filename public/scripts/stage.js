(function () {
  const root = document.getElementById('tvRoot');
  const stage = document.getElementById('tvStage');
  const logo = document.getElementById('tvLogo');
  const osd = document.getElementById('osd');
  const STORAGE_KEY = 'fratchtv.aspect';
  const LOGO_POSITIONS = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];

  // Gli stessi valori di config.json: se /settings non risponde, il look non cambia.
  const DEFAULTS = {
    defaultAspect: '16:9',
    aspectModes: ['16:9', '4:3', 'screen'],
    idleSeconds: 3,
    logo: {
      enabled: true,
      src: '/assets/logo.svg',
      position: 'top-right',
      size: 12,
      margin: 2,
      opacity: 0.7,
      filter: 'blur(0.5px) drop-shadow(0 0 2px black)',
    },
  };

  let settings = DEFAULTS;
  let modes = DEFAULTS.aspectModes;
  let modeIndex = 0;
  let logoVisible = true;
  let osdTimer;
  let idleTimer;
  let idleMs = DEFAULTS.idleSeconds * 1000;

  const isValidMode = (m) => m === 'screen' || /^\d+(\.\d+)?:\d+(\.\d+)?$/.test(m);

  function ratioOf(mode) {
    if (mode === 'screen') return window.innerWidth / window.innerHeight;
    const [w, h] = mode.split(':').map(Number);
    return w / h;
  }

  function showOsd(text, duration = 1500) {
    osd.textContent = text;
    osd.classList.add('visible');
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => osd.classList.remove('visible'), duration);
  }

  function applyAspect(announce) {
    const mode = modes[modeIndex];
    stage.style.setProperty('--ratio', ratioOf(mode));
    stage.dataset.aspect = mode;
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) { /* ignora */ }
    if (announce) showOsd(mode === 'screen' ? 'Formato: schermo' : `Formato: ${mode}`);
  }

  function applyLogo() {
    const cfg = settings.logo;
    if (!cfg.enabled || !cfg.src || !logoVisible) {
      logo.hidden = true;
      return;
    }
    if (logo.getAttribute('src') !== cfg.src) logo.src = cfg.src;
    logo.dataset.pos = LOGO_POSITIONS.includes(cfg.position) ? cfg.position : 'top-right';
    logo.style.setProperty('--logo-size', cfg.size);
    logo.style.setProperty('--logo-margin', cfg.margin);
    logo.style.opacity = cfg.opacity;
    logo.style.filter = cfg.filter || '';
    logo.hidden = false;
  }

  function cycleAspect() {
    modeIndex = (modeIndex + 1) % modes.length;
    applyAspect(true);
  }

  function toggleLogo() {
    logoVisible = !logoVisible;
    applyLogo();
    showOsd(logoVisible ? 'Logo: on' : 'Logo: off');
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      root.requestFullscreen().catch(() => {});
    }
  }

  // Modalità kiosk: cursore e barra dei controlli spariscono dopo idleMs senza movimenti
  function wakeUi() {
    root.classList.remove('idle');
    clearTimeout(idleTimer);
    if (idleMs > 0) idleTimer = setTimeout(() => root.classList.add('idle'), idleMs);
  }

  async function init() {
    try {
      const response = await fetch('/settings');
      if (response.ok) {
        const remote = await response.json();
        settings = { ...DEFAULTS, ...remote, logo: { ...DEFAULTS.logo, ...(remote.logo || {}) } };
      }
    } catch (e) {
      console.warn('Impostazioni non disponibili, uso i default.');
    }

    const validModes = (settings.aspectModes || []).filter(isValidMode);
    modes = validModes.length ? validModes : DEFAULTS.aspectModes;

    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignora */ }
    const start = modes.includes(saved) ? saved : settings.defaultAspect;
    modeIndex = Math.max(0, modes.indexOf(start));

    const idleSeconds = Number(settings.idleSeconds);
    idleMs = Number.isFinite(idleSeconds) ? idleSeconds * 1000 : DEFAULTS.idleSeconds * 1000;

    applyAspect(false);
    applyLogo();
    wakeUi();
  }

  // Se il logo non si carica lo nascondiamo invece di mostrare l'icona di immagine rotta
  logo.addEventListener('error', () => {
    logo.hidden = true;
    console.warn('Logo non trovato:', logo.getAttribute('src'));
  });

  // In modalità "schermo" il rapporto segue la finestra
  window.addEventListener('resize', () => {
    if (modes[modeIndex] === 'screen') applyAspect(false);
  });

  ['mousemove', 'mousedown', 'touchstart'].forEach((type) =>
    document.addEventListener(type, wakeUi, { passive: true }),
  );

  // Doppio click sullo stage = schermo intero
  stage.addEventListener('dblclick', toggleFullscreen);

  window.TvStage = {
    cycleAspect,
    toggleLogo,
    toggleFullscreen,
    notify: (text) => showOsd(text, 4000),
  };
  init();
})();