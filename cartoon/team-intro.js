(() => {
  'use strict';

  const dialog = document.getElementById('team-intro-dialog');
  if (!dialog) return;

  const ui = Object.fromEntries([
    'title', 'close', 'stage', 'replay', 'sound', 'volume', 'volume-value', 'status', 'team-switch',
  ].map(name => [name, document.getElementById(`intro-${name}`)]));
  if (Object.values(ui).some(node => !node)) return;

  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const entranceDuration = 1800;
  const mutedKey = 'big-banqiao-intro-muted';
  const volumeKey = 'big-banqiao-intro-volume';
  let activeTeam = null;
  let members = [];
  let timer = null;
  let audioSequence = 0;
  let opener = null;
  let openerTeam = null;
  let openerContext = null;
  let muted = false;
  let volume = 35;

  try {
    muted = localStorage.getItem(mutedKey) === 'true';
    const storedVolume = localStorage.getItem(volumeKey);
    if (storedVolume !== null && storedVolume.trim() !== '' && Number.isFinite(Number(storedVolume))) {
      volume = Math.max(0, Math.min(100, Number(storedVolume)));
    }
  } catch { /* Controls remain usable when browser storage is unavailable. */ }

  const reducedMotion = () => document.documentElement.dataset.motion === 'reduced' || Boolean(motionQuery?.matches);
  const teamTitle = () => activeTeam.id === 'HRM' ? 'HRM 獨立挑戰' : `${activeTeam.label}・${activeTeam.name}`;
  const audioEngine = () => window.RallyIntroAudio;

  function savePreference(key, value) {
    try { localStorage.setItem(key, String(value)); } catch { /* Session-only preference. */ }
  }

  function clearAnimation() {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    dialog.dataset.animating = 'false';
  }

  function stopEffects() {
    clearAnimation();
    audioSequence += 1;
    audioEngine()?.stop();
  }

  function soundDescription() {
    return muted ? '音效已關閉。' : volume === 0 ? '音量為 0%。' : `音效音量 ${volume}%。`;
  }

  function announce(suffix = soundDescription()) {
    if (!activeTeam || !dialog.open) return;
    ui.status.textContent = members.length
      ? `${teamTitle()}，${members.length} 位隊員已全部呈現。${suffix}`
      : `${teamTitle()}目前沒有隊員資料，請稍後再試。`;
  }

  function updateControls() {
    ui.replay.disabled = members.length === 0;
    ui.sound.textContent = muted ? '音效：關' : '音效：開';
    ui.sound.setAttribute('aria-pressed', String(!muted));
    ui.sound.setAttribute('aria-label', muted ? '開啟音效，下次播放時生效' : '關閉音效');
    ui.volume.value = String(volume);
    ui['volume-value'].textContent = `${volume}%`;
    ui.volume.setAttribute('aria-valuetext', `${volume}%${muted ? '，目前靜音' : ''}`);
    ui['team-switch'].querySelectorAll('[data-intro-switch]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.introSwitch === activeTeam?.id));
    });
  }

  function renderTeam() {
    if (!activeTeam) return;
    const teamId = activeTeam.id;
    const totalTarget = members.reduce((sum, person) => sum + person.target, 0);
    dialog.dataset.team = teamId;
    dialog.dataset.scene = 'ensemble';
    ui.title.textContent = teamTitle();
    dialog.style.setProperty('--intro-team', activeTeam.color);
    dialog.style.setProperty('--intro-ink', '#183153');
    if (!members.length) {
      ui.stage.innerHTML = '<section class="ensemble-banner"><p class="ensemble-kicker">TEAM INTRO</p><h3>隊員資料準備中</h3><p class="ensemble-summary">目前沒有可介紹的隊員，請稍後再試。</p></section>';
    } else {
      const mascot = teamId === 'HRM' ? 'assets/hrm-leader.png' : `assets/team-${teamId.toLowerCase()}-runner.png`;
      // All cards exist together. No carousel, per-member delay, or hidden next scene.
      ui.stage.innerHTML = `<div class="ensemble-impact" aria-hidden="true"></div><section class="ensemble-banner"><p class="ensemble-kicker">ALL HANDS ON DECK</p><h3>全員集結！</h3><p class="ensemble-summary">${members.length} 位夥伴・開門紅責任目標 <b>${money(totalTarget)}</b></p></section><div class="ensemble-body"><aside class="ensemble-mascot" aria-hidden="true"><span class="ensemble-letter">${esc(teamId)}</span><img src="${mascot}" alt="" decoding="async"></aside><ol class="ensemble-roster">${members.map((person, index) => `<li class="ensemble-member"><span class="ensemble-number">${String(index + 1).padStart(2, '0')}</span><h4 class="ensemble-name">${esc(person.name)}</h4><p class="ensemble-meta">${esc(person.branch.replace('分行', ''))}・${esc(person.level)}</p><p class="ensemble-target"><small>開門紅目標</small><b>${money(person.target)}</b></p></li>`).join('')}</ol></div>`;
      ui.stage.querySelector('.ensemble-mascot img')?.addEventListener('error', event => {
        event.currentTarget.style.display = 'none';
      }, {once: true});
    }
    ui.stage.scrollTop = 0;
    updateControls();
  }

  function playEntrance() {
    if (!dialog.open || !members.length || document.hidden) return;
    stopEffects();
    const sequence = audioSequence;
    if (!reducedMotion()) {
      // Restart one shared entrance without replacing the already visible roster.
      void ui.stage.offsetWidth;
      dialog.dataset.animating = 'true';
      timer = window.setTimeout(() => {
        timer = null;
        dialog.dataset.animating = 'false';
      }, entranceDuration);
    }
    announce();
    if (muted || volume === 0) return;
    const engine = audioEngine();
    if (!engine) {
      announce('此瀏覽器暫時無法播放音效；隊員介紹不受影響。');
      return;
    }
    // Called synchronously from the click: AudioContext resume retains user activation.
    try {
      const playback = engine.play({volume: volume / 100});
      Promise.resolve(playback).then(started => {
        if (sequence !== audioSequence || !dialog.open || document.hidden || muted) return;
        announce(started ? soundDescription() : '瀏覽器未播放音效，可按「重播全員登場」再試。');
      }).catch(() => {
        if (sequence === audioSequence && dialog.open && !muted) announce('音效暫時無法播放；隊員介紹不受影響。');
      });
    } catch {
      if (sequence === audioSequence && dialog.open) announce('音效暫時無法播放；隊員介紹不受影響。');
    }
  }

  function findTeam(teamId) {
    return teams.find(team => team.id === teamId) || (teamId === 'HRM'
      ? {id: 'HRM', label: 'HRM', name: 'HRM 獨立挑戰', color: '#8267d9'} : null);
  }

  function selectTeam(teamId) {
    const team = findTeam(teamId);
    if (!team) return false;
    stopEffects();
    activeTeam = team;
    members = people.filter(person => person.team === teamId);
    renderTeam();
    announce();
    return true;
  }

  function openIntroduction(button) {
    const teamId = button.dataset.introTeam;
    if (!findTeam(teamId)) return;
    opener = button;
    openerTeam = teamId;
    openerContext = ['#player-cards', '.team-intro-hub', '.hrm-stage'].find(selector => button.closest(selector)) || null;
    document.documentElement.dataset.introOpen = 'true';
    if (!dialog.open) dialog.showModal();
    if (selectTeam(teamId)) playEntrance();
    ui.close.focus({preventScroll: true});
  }

  function cleanup() {
    // A queued close event must not clear an introduction that has just reopened.
    if (dialog.open) return;
    stopEffects();
    delete document.documentElement.dataset.introOpen;
    ui.stage.replaceChildren();
    ui.status.textContent = '';
    const isAvailable = button => button?.isConnected && button.getClientRects().length > 0 && !button.disabled;
    const originalOpener = isAvailable(opener) ? opener : null;
    const matchingButtons = openerTeam ? [...document.querySelectorAll(`[data-intro-team="${openerTeam}"]`)].filter(isAvailable) : [];
    const contextualReplacement = openerContext ? matchingButtons.find(button => button.closest(openerContext)) : null;
    (originalOpener || contextualReplacement || matchingButtons[0])?.focus({preventScroll: true});
    opener = null;
    openerTeam = null;
    openerContext = null;
    activeTeam = null;
    members = [];
    updateControls();
  }

  // Loading the page creates neither an animation timer nor an AudioContext.
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button[data-intro-team]');
    if (!button || button.disabled) return;
    openIntroduction(button);
  });
  ui.close.addEventListener('click', () => {
    stopEffects();
    if (dialog.open) dialog.close();
  });
  dialog.addEventListener('cancel', stopEffects);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) stopEffects();
  });
  dialog.addEventListener('close', cleanup);
  ui['team-switch'].addEventListener('click', event => {
    const button = event.target.closest?.('button[data-intro-switch]');
    if (!dialog.open || !button || button.disabled || button.dataset.introSwitch === activeTeam?.id) return;
    if (selectTeam(button.dataset.introSwitch)) playEntrance();
  });
  ui.replay.addEventListener('click', playEntrance);
  ui.sound.addEventListener('click', () => {
    muted = !muted;
    savePreference(mutedKey, muted);
    if (muted) {
      audioSequence += 1;
      audioEngine()?.stop();
    }
    updateControls();
    announce(muted ? '音效已關閉。' : '音效已開啟，點「重播全員登場」或切換組別時生效。');
  });
  ui.volume.addEventListener('input', () => {
    const nextVolume = Number(ui.volume.value);
    if (!Number.isFinite(nextVolume)) return;
    volume = Math.max(0, Math.min(100, nextVolume));
    savePreference(volumeKey, volume);
    audioEngine()?.setVolume(volume / 100);
    updateControls();
  });
  ui.volume.addEventListener('change', () => announce());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !dialog.open) return;
    stopEffects();
    announce('已停止入場動畫與音效；回來後可按「重播全員登場」。');
  });
  const onMotionChange = () => {
    if (!dialog.open || !reducedMotion()) return;
    clearAnimation();
    announce(`減少動畫模式，全部隊員仍完整顯示。${soundDescription()}`);
  };
  new MutationObserver(onMotionChange).observe(document.documentElement, {attributes: true, attributeFilter: ['data-motion']});
  if (motionQuery?.addEventListener) motionQuery.addEventListener('change', onMotionChange);
  else motionQuery?.addListener?.(onMotionChange);
  updateControls();
})();
