(() => {
  'use strict';

  const dialog = document.getElementById('team-intro-dialog');
  if (!dialog) return;

  const ui = Object.fromEntries([
    'title', 'close', 'stage', 'progress', 'progress-fill', 'position',
    'timeline', 'prev', 'toggle', 'next', 'replay', 'status',
  ].map(name => [name, document.getElementById(`intro-${name}`)]));
  if (Object.values(ui).some(node => !node)) return;

  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const coverDuration = 2200;
  const memberDuration = 4000;
  let activeTeam = null;
  let members = [];
  let sceneIndex = 0;
  let playing = false;
  let timer = null;
  let remaining = 0;
  let startedAt = 0;
  let opener = null;
  let openerContext = null;

  const reducedMotion = () => document.documentElement.dataset.motion === 'reduced' || Boolean(motionQuery?.matches);
  const lastScene = () => members.length + 1;
  const sceneDuration = () => sceneIndex === 0 ? coverDuration : sceneIndex <= members.length ? memberDuration : 0;
  const mascotPath = () => activeTeam.id === 'HRM' ? 'assets/hrm-leader.png' : `assets/team-${activeTeam.id.toLowerCase()}-runner.png`;
  const teamTitle = () => activeTeam.id === 'HRM' ? 'HRM 獨立挑戰' : `${activeTeam.label}・${activeTeam.name}`;

  function clearTimer() {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  }

  function updateControls() {
    const empty = members.length === 0;
    const atEnd = sceneIndex === lastScene();
    dialog.dataset.playing = String(playing);
    ui.prev.disabled = empty || sceneIndex === 0;
    ui.next.disabled = empty || atEnd;
    ui.toggle.disabled = empty || atEnd || reducedMotion();
    ui.toggle.textContent = playing ? '暫停播放' : reducedMotion() ? '手動介紹' : '繼續播放';
    ui.toggle.setAttribute('aria-pressed', String(playing));
    ui.toggle.setAttribute('aria-label', playing ? '暫停隊員介紹' : reducedMotion() ? '減少動畫模式，請用上一位或下一位查看' : '繼續播放隊員介紹');
    ui.replay.disabled = empty;
    ui.replay.textContent = reducedMotion() ? '回到開場' : '重新播放';
    ui.timeline.querySelectorAll('[data-intro-index]').forEach(button => {
      const current = Number(button.dataset.introIndex) === sceneIndex;
      if (current) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    keepCurrentStepVisible();
  }

  function keepCurrentStepVisible() {
    if (!dialog.open) return;
    const current = ui.timeline.querySelector('[aria-current="step"]');
    if (!current) return;
    const viewport = ui.timeline.getBoundingClientRect();
    const item = current.getBoundingClientRect();
    const left = viewport.left + ui.timeline.clientLeft + 4;
    const right = viewport.left + ui.timeline.clientLeft + ui.timeline.clientWidth - 4;
    const offset = item.left < left ? item.left - left : item.right > right ? item.right - right : 0;
    // Scroll only the numbered strip, never the dialog or the document behind it.
    if (offset) ui.timeline.scrollTo({left: ui.timeline.scrollLeft + offset, behavior: 'instant'});
  }

  function updateProgress() {
    const amount = members.length ? Math.round(sceneIndex / lastScene() * 100) : 0;
    const label = !members.length ? '尚無隊員資料' : sceneIndex === 0 ? `開場・共 ${members.length} 位隊員` : sceneIndex === lastScene() ? '介紹完成・全隊集結' : `隊員 ${sceneIndex} / ${members.length}`;
    ui.progress.setAttribute('aria-valuenow', String(amount));
    ui.progress.setAttribute('aria-valuetext', label);
    ui['progress-fill'].style.width = `${amount}%`;
    ui.position.textContent = label;
  }

  function stageVisual() {
    return `<div class="intro-visual" aria-hidden="true"><span class="intro-letter">${esc(activeTeam.id)}</span><img class="intro-mascot" src="${mascotPath()}" alt="" decoding="async"></div>`;
  }

  function targetMarkup(value, label) {
    return `<p class="intro-target"><small>${label}</small><b>${money(value)}</b></p>`;
  }

  function renderScene() {
    if (!activeTeam) return;
    let content;
    const totalTarget = members.reduce((sum, person) => sum + person.target, 0);
    if (!members.length) {
      dialog.dataset.scene = 'cover';
      content = '<div class="intro-content"><p class="intro-kicker">TEAM INTRO</p><h3 class="intro-team-name">隊員資料準備中</h3><p class="intro-note">目前沒有可介紹的隊員，請稍後再試。</p></div>';
    } else if (sceneIndex === 0) {
      dialog.dataset.scene = 'cover';
      content = `<div class="intro-content"><p class="intro-kicker">${activeTeam.id === 'HRM' ? 'INDEPENDENT CHALLENGE' : `TEAM ${esc(activeTeam.id)} · READY TO RUN`}</p><h3 class="intro-team-name">${esc(activeTeam.name)}</h3><p class="intro-detail">${members.length} 位隊員・${[...new Set(members.map(person => person.branch))].map(esc).join(' / ')}</p>${targetMarkup(totalTarget, '開門紅責任目標合計')}<p class="intro-note">${reducedMotion() ? '點「下一位」或下方編號，認識每位隊員。' : '隊員即將依序登場；隨時可以暫停或自行切換。'}</p></div>`;
    } else if (sceneIndex === lastScene()) {
      dialog.dataset.scene = 'finale';
      content = `<div class="intro-content"><p class="intro-kicker">${activeTeam.id === 'HRM' ? 'READY FOR THE CHALLENGE' : 'ONE TEAM · ONE GOAL'}</p><h3 class="intro-team-name">${activeTeam.id === 'HRM' ? '挑戰準備就緒！' : '全員到齊，一起出發！'}</h3><div class="intro-lineup">${members.map(person => `<span><b>${esc(person.name)}</b><small>${esc(person.branch.replace('分行', ''))}・${esc(person.level)}</small></span>`).join('')}</div>${targetMarkup(totalTarget, '開門紅責任目標合計')}<p class="intro-note">介紹已結束，可重新播放或關閉返回戰況。</p></div>`;
    } else {
      dialog.dataset.scene = 'member';
      const person = members[sceneIndex - 1];
      content = `<div class="intro-content"><p class="intro-kicker">PLAYER ${String(sceneIndex).padStart(2, '0')} / ${String(members.length).padStart(2, '0')}</p><h3 class="intro-name">${esc(person.name)}</h3><p class="intro-detail">${esc(person.branch)}<span aria-hidden="true"> · </span>${esc(person.level)}</p>${targetMarkup(person.target, '個人開門紅責任目標')}<p class="intro-note">${esc(teamTitle())}・角色為隊伍吉祥物，非個人肖像。</p></div>`;
    }
    ui.stage.innerHTML = `${stageVisual()}${content}`;
    ui.stage.scrollTop = 0;
    ui.stage.querySelector('.intro-mascot')?.addEventListener('error', event => {
      event.currentTarget.style.display = 'none';
    }, {once: true});
    updateProgress();
    updateControls();
  }

  function announceScene(prefix = '') {
    if (!activeTeam) return;
    const description = sceneIndex === 0 ? `${teamTitle()}，共 ${members.length} 位隊員。` : sceneIndex === lastScene() ? `${teamTitle()}介紹完成。` : `第 ${sceneIndex} 位，${members[sceneIndex - 1].name}，${members[sceneIndex - 1].branch}，${members[sceneIndex - 1].level}，開門紅責任目標 ${money(members[sceneIndex - 1].target)}。`;
    ui.status.textContent = `${prefix}${description}`;
  }

  function scheduleScene() {
    clearTimer();
    if (!playing || !dialog.open || sceneIndex >= lastScene()) return;
    startedAt = window.performance.now();
    timer = window.setTimeout(() => {
      timer = null;
      if (!dialog.open || !playing) return;
      if (document.hidden || reducedMotion()) {
        pause('介紹已暫停，請手動繼續。');
        return;
      }
      changeScene(sceneIndex + 1, true);
    }, remaining);
  }

  function pause(message = '') {
    if (playing && timer !== null) remaining = Math.max(0, remaining - (window.performance.now() - startedAt));
    clearTimer();
    playing = false;
    updateControls();
    if (message) ui.status.textContent = message;
  }

  function changeScene(index, shouldPlay = false) {
    if (!dialog.open || !activeTeam) return;
    clearTimer();
    sceneIndex = Math.max(0, Math.min(index, lastScene()));
    remaining = sceneDuration();
    playing = shouldPlay && !reducedMotion() && !document.hidden && sceneIndex < lastScene() && members.length > 0;
    renderScene();
    announceScene();
    scheduleScene();
  }

  function togglePlayback() {
    if (!dialog.open || !members.length || reducedMotion() || sceneIndex === lastScene()) return;
    if (playing) {
      pause('介紹已暫停，可繼續播放或手動選擇隊員。');
      return;
    }
    if (document.hidden) return;
    playing = true;
    updateControls();
    announceScene('繼續播放。');
    scheduleScene();
  }

  function renderTimeline() {
    ui.timeline.innerHTML = members.length ? `<button type="button" class="intro-timeline-button" data-intro-index="0" aria-label="查看隊伍開場">開場</button>${members.map((person, index) => `<button type="button" class="intro-timeline-button" data-intro-index="${index + 1}" aria-label="查看第 ${index + 1} 位隊員 ${esc(person.name)}" title="${esc(person.name)}">${String(index + 1).padStart(2, '0')}</button>`).join('')}<button type="button" class="intro-timeline-button" data-intro-index="${lastScene()}" aria-label="查看全隊名單">全隊</button>` : '';
  }

  function openIntroduction(button) {
    const teamId = button.dataset.introTeam;
    const team = teams.find(item => item.id === teamId) || (teamId === 'HRM' ? {id: 'HRM', label: 'HRM', name: 'HRM 獨立挑戰', color: '#8267d9'} : null);
    if (!team) return;
    clearTimer();
    opener = button;
    openerContext = ['#player-cards', '.team-intro-hub', '.hrm-stage'].find(selector => button.closest(selector)) || null;
    activeTeam = team;
    dialog.dataset.team = teamId;
    members = people.filter(person => person.team === teamId);
    ui.title.textContent = teamTitle();
    dialog.style.setProperty('--intro-team', team.color);
    dialog.style.setProperty('--intro-ink', '#183153');
    document.documentElement.dataset.introOpen = 'true';
    if (!dialog.open) dialog.showModal();
    renderTimeline();
    changeScene(0, !reducedMotion());
    if (reducedMotion()) ui.status.textContent = '減少動畫模式：請用下一位、上一位或下方編號，手動查看隊員介紹。';
    ui.close.focus({preventScroll: true});
  }

  function cleanup() {
    // A queued close event must not clear an introduction that has just reopened.
    if (dialog.open) return;
    const teamId = activeTeam?.id;
    clearTimer();
    playing = false;
    dialog.dataset.playing = 'false';
    delete document.documentElement.dataset.introOpen;
    ui.stage.replaceChildren();
    ui.timeline.replaceChildren();
    ui.status.textContent = '';
    const isAvailable = button => button?.isConnected && button.getClientRects().length > 0 && !button.disabled;
    const originalOpener = isAvailable(opener) ? opener : null;
    const matchingButtons = teamId ? [...document.querySelectorAll(`[data-intro-team="${teamId}"]`)].filter(isAvailable) : [];
    const contextualReplacement = openerContext ? matchingButtons.find(button => button.closest(openerContext)) : null;
    (originalOpener || contextualReplacement || matchingButtons[0])?.focus({preventScroll: true});
    opener = null;
    openerContext = null;
    activeTeam = null;
    members = [];
    sceneIndex = 0;
    remaining = 0;
    startedAt = 0;
  }

  // No animation timer is created until an introduction button is explicitly clicked.
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button[data-intro-team]');
    if (!button || button.disabled) return;
    openIntroduction(button);
  });
  ui.close.addEventListener('click', () => { if (dialog.open) dialog.close(); });
  dialog.addEventListener('close', cleanup);
  ui.prev.addEventListener('click', () => changeScene(sceneIndex - 1));
  ui.next.addEventListener('click', () => changeScene(sceneIndex + 1));
  ui.toggle.addEventListener('click', togglePlayback);
  ui.replay.addEventListener('click', () => changeScene(0, !reducedMotion()));
  ui.timeline.addEventListener('click', event => {
    const button = event.target.closest?.('[data-intro-index]');
    if (!button) return;
    const index = Number(button.dataset.introIndex);
    if (Number.isInteger(index) && index >= 0 && index <= lastScene()) changeScene(index);
  });
  dialog.addEventListener('keydown', event => {
    if (!dialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (members.length) changeScene(sceneIndex + (event.key === 'ArrowRight' ? 1 : -1));
    } else if ((event.key === ' ' || event.code === 'Space') && !event.target.closest('button, a, input, select, textarea, [contenteditable="true"]')) {
      event.preventDefault();
      togglePlayback();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && dialog.open) pause('已離開頁面，隊員介紹暫停；回來後可按繼續播放。');
  });
  const onMotionChange = () => {
    if (!dialog.open) return;
    if (reducedMotion()) pause('減少動畫模式：介紹已暫停，請用按鈕手動查看隊員。');
    else updateControls();
  };
  new MutationObserver(onMotionChange).observe(document.documentElement, {attributes: true, attributeFilter: ['data-motion']});
  if (motionQuery?.addEventListener) motionQuery.addEventListener('change', onMotionChange);
  else motionQuery?.addListener?.(onMotionChange);
})();
