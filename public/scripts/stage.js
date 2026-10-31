(function () {
  const root = document.getElementById('tvRoot');
  const stage = document.getElementById('tvStage');
  const logo = document.getElementById('tvLogo');
  const osd = document.getElementById('osd');
  const STORAGE_KEY = 'fratchtv.aspect';

  const DEFAULTS = {
    defaultAspect: '16:9',
    aspectModes: ['16:9', '4:3', 'screen'],
    logo: { enabled: true, src: '/logo.svg', position: 'top-right', size: 12, margin: 2, opacity: 0.7, filter: 'blur(0.5px)' },
  };

  let settings = DEFAULTS;
  let modes = DEFAULTS.aspectModes;
  let modeIndex = 0;
  let logoVisible = true;
  let osdTimer;

  const isValidMode = (m) => m === 'screen' || /^\d+(\.\d+)?:\d+(\.\d+)?$/.test(m);

  function ratioOf(mode) {
    if (mode === 'screen') return window.innerWidth / window.innerHeight;
    const [w, h] = mode.split(':').map(Number);
    return w / h;
  }

  function showOsd(text) {
    osd.textContent = text;
    osd.classList.add('visible');
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => osd.classList.remove('visible'), 1500);
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
    logo.src = cfg.src;
    logo.dataset.pos = cfg.position;
    logo.style.setProperty('--logo-size', cfg.size);
    logo.style.setProperty('--logo-margin', cfg.margin);
    logo.style.opacity = cfg.opacity;
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

    applyAspect(false);
    applyLogo();
  }

  // In modalità "schermo" il rapporto segue la finestra
  window.addEventListener('resize', () => {
    if (modes[modeIndex] === 'screen') applyAspect(false);
  });

  // Doppio click sullo stage = schermo intero
  stage.addEventListener('dblclick', toggleFullscreen);

  window.TvStage = { cycleAspect, toggleLogo, toggleFullscreen };
  init();
})();