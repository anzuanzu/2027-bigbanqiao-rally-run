const people = [
  { team: 'A', branch: '板橋分行', level: 'SRM1', name: '溫志剛', target: 25_000_000 },
  { team: 'A', branch: '板橋分行', level: 'SRM1', name: '李宗杰', target: 15_000_000 },
  { team: 'A', branch: '板橋分行', level: 'SRM1', name: '周韻如', target: 15_000_000 },
  { team: 'A', branch: '板橋分行', level: 'SRM1', name: '吳采妍', target: 11_000_000 },
  { team: 'A', branch: '華江分行', level: 'SRM2', name: '黃柏飛', target: 10_000_000 },
  { team: 'A', branch: '新板分行', level: 'RM1', name: '周至浩', target: 10_000_000 },
  { team: 'A', branch: '新板分行', level: 'SRM2', name: '郭淑芬', target: 10_000_000 },
  { team: 'A', branch: '新板分行', level: 'RM2', name: '盧品豪', target: 5_000_000 },
  { team: 'A', branch: '新板分行', level: 'RM2', name: '王泓權', target: 1_000_000 },

  { team: 'B', branch: '板橋分行', level: 'SRM1', name: '許凱婷', target: 25_000_000 },
  { team: 'B', branch: '板橋分行', level: 'SRM1', name: '宋柏陞', target: 15_000_000 },
  { team: 'B', branch: '板橋分行', level: 'JRM', name: '洪易佳', target: 5_000_000 },
  { team: 'B', branch: '華江分行', level: 'SRM1', name: '廖敏慧', target: 15_000_000 },
  { team: 'B', branch: '華江分行', level: 'SRM1', name: '詹采榆', target: 12_500_000 },
  { team: 'B', branch: '新板分行', level: 'SRM2', name: '林靜芸', target: 10_000_000 },
  { team: 'B', branch: '新板分行', level: 'RM1', name: '詹忠儒', target: 10_000_000 },
  { team: 'B', branch: '新板分行', level: 'SRM2', name: '艾祺倫', target: 10_000_000 },

  { team: 'C', branch: '板橋分行', level: 'SRM1', name: '張瓊月', target: 15_000_000 },
  { team: 'C', branch: '板橋分行', level: 'SRM1', name: '宋婷婷', target: 15_000_000 },
  { team: 'C', branch: '板橋分行', level: 'SRM2', name: '李承紘', target: 9_000_000 },
  { team: 'C', branch: '華江分行', level: 'SRM2', name: '施雯晴', target: 10_000_000 },
  { team: 'C', branch: '華江分行', level: 'RM1', name: '徐小凡', target: 10_000_000 },
  { team: 'C', branch: '新板分行', level: 'SRM1', name: '黃淑卿', target: 20_000_000 },
  { team: 'C', branch: '新板分行', level: 'RM1', name: '陳奕憲', target: 15_000_000 },
  { team: 'C', branch: '新板分行', level: 'SRM1', name: '朱麗鳳', target: 10_000_000 },

  { team: 'HRM', branch: '新板分行', level: 'HRM', name: '楊璧菁', target: 30_000_000 },
];

const teams = [
  { id: 'A', label: 'A 組', color: '#c92632', slogan: '先鋒聚力' },
  { id: 'B', label: 'B 組', color: '#d29a2f', slogan: '穩健攻頂' },
  { id: 'C', label: 'C 組', color: '#10846b', slogan: '協力致勝' },
];

const config = window.SUPABASE_CONFIG || {};
const isConfigured = Boolean(config.url && config.anonKey && String(config.url).startsWith('https://'));
const hasManagerUploadAccount = Boolean(config.uploadAccountEmail && String(config.uploadAccountEmail).includes('@'));
const branchTargetRecordName = '__分行季目標__';
const $ = (id) => document.getElementById(id);

let supabase = null;
let currentUser = null;
let canWrite = false;
let hasLoaded = false;
let performance = {};
let selectedTeam = 'all';
let busy = false;

const key = (branch, name) => `${branch}-${name}`;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[character]);

function asNumber(value) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, '').replace(/%/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function formatWan(value, decimals = 0) {
  const amount = asNumber(value) / 10_000;
  return amount.toLocaleString('zh-TW', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatMoneyCompact(value) {
  const amount = asNumber(value);
  if (amount >= 100_000_000) {
    return `${(amount / 100_000_000).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} 億`;
  }
  return `${formatWan(amount)} 萬`;
}

function formatRate(progress, target) {
  return target > 0 ? `${(progress / target * 100).toFixed(1)}%` : '—';
}

function progressFor(person) {
  return asNumber(performance[key(person.branch, person.name)]?.quarterProgress);
}

function teamStats(teamId) {
  const members = people.filter((person) => person.team === teamId);
  const target = members.reduce((sum, person) => sum + person.target, 0);
  const progress = members.reduce((sum, person) => sum + progressFor(person), 0);
  return { members, target, progress, rate: target ? progress / target * 100 : 0 };
}

function totalStats() {
  const target = people.reduce((sum, person) => sum + person.target, 0);
  const progress = people.reduce((sum, person) => sum + progressFor(person), 0);
  return { target, progress, rate: target ? progress / target * 100 : 0 };
}

function rankTeams() {
  if (!hasLoaded) return new Map(teams.map((team) => [team.id, null]));
  const ranked = teams
    .map((team) => ({ id: team.id, ...teamStats(team.id) }))
    .sort((first, second) => second.rate - first.rate || second.progress - first.progress || first.id.localeCompare(second.id));
  return new Map(ranked.map((team, index) => [team.id, index + 1]));
}

function sourceDates() {
  return [...new Set(Object.values(performance).map((record) => record.sourceDate).filter(Boolean))];
}

function renderCountdown() {
  const now = new Date();
  const start = new Date('2026-11-01T00:00:00+08:00');
  const end = new Date('2027-02-28T23:59:59+08:00');
  const day = 86_400_000;
  if (now < start) {
    $('countdown-label').textContent = '距離開賽';
    $('countdown-value').textContent = `${Math.ceil((start - now) / day)} 天`;
  } else if (now <= end) {
    $('countdown-label').textContent = '賽程倒數';
    $('countdown-value').textContent = `${Math.max(1, Math.ceil((end - now) / day))} 天`;
  } else {
    $('countdown-label').textContent = '競賽狀態';
    $('countdown-value').textContent = '已結束';
  }
}

function renderOverall() {
  const total = totalStats();
  $('overall-progress').textContent = hasLoaded ? formatMoneyCompact(total.progress) : '—';
  $('overall-rate').textContent = hasLoaded ? `${total.rate.toFixed(1)}%` : '—';
  const dates = sourceDates();
  $('data-date').textContent = dates.length ? `資料日期 ${dates.join('、')}` : (hasLoaded ? '雲端資料已同步' : '資料尚未同步');
}

function trophyIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/></svg>';
}

function renderTeamSummary() {
  const ranks = rankTeams();
  $('team-summary').innerHTML = teams.map((team) => {
    const stats = teamStats(team.id);
    const rank = ranks.get(team.id);
    const remaining = Math.max(stats.target - stats.progress, 0);
    return `
      <article class="team-score-card ${rank === 1 ? 'leader' : ''}" style="--team-color:${team.color}">
        <div class="score-card-head">
          <div class="team-ident"><span class="team-letter">${team.id}</span><span><b>${team.label}</b><small>${team.slogan}・${stats.members.length} 位</small></span></div>
          <span class="rank-badge">${rank === 1 ? trophyIcon() : ''}${rank ? `第 ${rank} 名` : '待同步'}</span>
        </div>
        <div class="team-score-main"><span>目前進度</span><strong>${hasLoaded ? formatMoneyCompact(stats.progress) : '—'} <small>/ ${formatMoneyCompact(stats.target)}</small></strong></div>
        <div class="progress-head"><span>團隊達成率</span><b>${hasLoaded ? formatRate(stats.progress, stats.target) : '—'}</b></div>
        <div class="progress-track" aria-label="${team.label}達成率 ${hasLoaded ? formatRate(stats.progress, stats.target) : '尚未同步'}"><i style="width:${hasLoaded ? Math.min(stats.rate, 100) : 0}%"></i></div>
        <div class="team-score-foot"><span>距離目標</span><b>${hasLoaded ? formatMoneyCompact(remaining) : '登入後顯示'}</b></div>
      </article>`;
  }).join('');
}

function memberProgressMarkup(person) {
  const progress = progressFor(person);
  if (!hasLoaded) return '<b>—</b><small>尚未同步</small>';
  const difference = progress - person.target;
  const statusClass = difference >= 0 ? 'ahead' : 'behind';
  const statusText = difference >= 0 ? `超標 ${formatMoneyCompact(difference)}` : `差 ${formatMoneyCompact(Math.abs(difference))}`;
  return `<b>${formatMoneyCompact(progress)}</b><small class="${statusClass}">${statusText}・${formatRate(progress, person.target)}</small>`;
}

function renderRosters() {
  $('team-rosters').innerHTML = teams.map((team) => {
    const stats = teamStats(team.id);
    const visible = selectedTeam === 'all' || selectedTeam === team.id;
    const memberRows = stats.members.map((person) => `
      <li class="member-row">
        <div class="member-main">
          <div class="member-name-line"><b>${escapeHtml(person.name)}</b><span class="branch-tag">${escapeHtml(person.branch.replace('分行', ''))}</span></div>
          <div class="member-meta"><span class="level">${escapeHtml(person.level)}</span><span>目標 ${formatMoneyCompact(person.target)}</span></div>
        </div>
        <div class="member-numbers">${memberProgressMarkup(person)}</div>
      </li>`).join('');
    return `
      <article class="roster-card ${visible ? '' : 'is-hidden'}" data-team-card="${team.id}" style="--team-color:${team.color}">
        <header class="roster-head">
          <span class="team-letter">${team.id}</span>
          <div><b>${team.label}・${team.slogan}</b><small>${stats.members.length} 位成員</small></div>
          <b class="roster-target">${formatWan(stats.target)}<small>萬目標</small></b>
        </header>
        <ul class="roster-list">${memberRows}</ul>
        <footer class="roster-foot"><span>組目標達成率</span><b>${hasLoaded ? formatRate(stats.progress, stats.target) : '待同步'}</b></footer>
      </article>`;
  }).join('');
}

function renderHrm() {
  const person = people.find((item) => item.team === 'HRM');
  const progress = progressFor(person);
  const rate = person.target ? progress / person.target * 100 : 0;
  $('hrm-rate').textContent = hasLoaded ? `${rate.toFixed(1)}%` : '—';
  $('hrm-progress-bar').style.width = `${hasLoaded ? Math.min(rate, 100) : 0}%`;
  $('hrm-progress-text').textContent = hasLoaded
    ? `${formatMoneyCompact(progress)} / ${formatMoneyCompact(person.target)}${rate >= 100 ? '・挑戰達成！' : ''}`
    : '登入後同步季進度（含在途）';
}

function render() {
  renderCountdown();
  renderOverall();
  renderTeamSummary();
  renderRosters();
  renderHrm();
}

function setStatus(message, tone = '') {
  $('status-message').textContent = message;
  $('status-message').className = `status-message ${tone}`;
}

function setUploadMessage(message, tone = '') {
  $('upload-message').textContent = message;
  $('upload-message').className = `upload-message ${tone}`;
}

function setCloudState(message, tone = '') {
  $('cloud-state').className = `cloud-state ${tone}`;
  $('cloud-state').querySelector('span').textContent = message;
}

function setBusy(nextBusy) {
  busy = nextBusy;
  $('dialog-sync-button').disabled = nextBusy;
  $('raw-file').disabled = nextBusy || !canWrite;
  $('performance-file').disabled = nextBusy || !canWrite;
  $('raw-file-label').classList.toggle('is-disabled', nextBusy || !canWrite);
  $('performance-file-label').classList.toggle('is-disabled', nextBusy || !canWrite);
  $('refresh-button').disabled = nextBusy || !currentUser;
  $('manage-button').disabled = nextBusy || !canWrite;
}

function recordMap(records) {
  return Object.fromEntries(records.map((record) => [key(record.branch, record.advisor_name), {
    quarterTarget: record.quarter_target,
    quarterProgress: record.quarter_progress,
    quarterRate: record.quarter_rate,
    fundProgress: record.fund_progress,
    insuranceProgress: record.insurance_progress,
    sourceDate: record.source_date || '',
  }]));
}

async function loadPerformance({ announce = true } = {}) {
  if (!supabase || !currentUser || busy) return;
  setBusy(true);
  if (announce) setStatus('正在同步雲端季進度（含在途）…');
  try {
    const { data, error } = await supabase
      .from('performance_records')
      .select('branch, advisor_name, quarter_target, quarter_progress, quarter_rate, fund_progress, insurance_progress, source_date')
      .neq('advisor_name', branchTargetRecordName)
      .order('branch')
      .order('advisor_name');
    if (error) throw error;
    performance = recordMap(data || []);
    hasLoaded = true;
    const dates = sourceDates();
    setStatus(`已同步 ${Object.keys(performance).length} 筆進度。${dates.length ? `資料日期：${dates.join('、')}` : '目前尚無來源日期。'}`, 'success');
    setUploadMessage(`已同步 ${Object.keys(performance).length} 筆雲端資料。`, 'success');
    render();
  } catch (error) {
    setStatus(`同步失敗：${error.message || '請稍後再試。'}`, 'error');
    setUploadMessage(`同步失敗：${error.message || '請稍後再試。'}`, 'error');
  } finally {
    setBusy(false);
  }
}

async function checkRole() {
  const { data, error } = await supabase.rpc('my_performance_role');
  if (error) throw error;
  return data;
}

async function applySession(session) {
  currentUser = session?.user || null;
  canWrite = false;
  hasLoaded = false;
  performance = {};
  $('login-button').hidden = Boolean(currentUser);
  $('manage-button').hidden = true;
  $('signout-button').hidden = !currentUser;

  if (!currentUser) {
    setCloudState('尚未登入');
    setStatus('登入後即可同步即時進度；分組與目標可先行查看。');
    setBusy(false);
    render();
    return;
  }

  try {
    setCloudState('驗證權限中…');
    const role = await checkRole();
    if (!role) {
      setCloudState('帳號未授權', 'error');
      setStatus('此帳號尚未被管理者授權查看績效資料。', 'error');
      setBusy(false);
      render();
      return;
    }
    canWrite = ['admin', 'editor'].includes(role);
    $('manage-button').hidden = !canWrite;
    setCloudState(role === 'viewer' ? '已登入・唯讀' : '雲端已連線', 'success');
    setBusy(false);
    await loadPerformance({ announce: false });
  } catch (error) {
    setCloudState('權限驗證失敗', 'error');
    setStatus(`無法驗證權限：${error.message || '請稍後再試。'}`, 'error');
    setBusy(false);
    render();
  }
}

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/[（）]/g, (character) => character === '（' ? '(' : ')')
    .replace(/\s/g, '')
    .trim();
}

function normalizeAdvisorName(value) {
  return String(value ?? '').replace(/\s/g, '').trim();
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function recordsFromRows(rows) {
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) throw new Error('找不到欄位標題。');
  const index = Object.fromEntries(headerRow.map((name, position) => [normalizeHeader(name), position]));
  const required = ['分行', '理專姓名', '季責任額', '季進度(含在途)', '季達成率', '基金進度', '保險進度'];
  const monthlyIndex = index['月進度'] ?? index['每月進度'] ?? index['個人成績(AP)'];
  if (required.some((name) => index[name] === undefined)) {
    throw new Error('檔案欄位不完整，請確認標準績效欄位名稱。');
  }
  return dataRows.map((row) => {
    const record = {
      branch: String(row[index['分行']] ?? '').trim(),
      advisor_name: normalizeAdvisorName(row[index['理專姓名']]),
      quarter_target: String(row[index['季責任額']] ?? '').trim(),
      quarter_progress: String(row[index['季進度(含在途)']] ?? '').trim(),
      quarter_rate: String(row[index['季達成率']] ?? '').trim(),
      fund_progress: String(row[index['基金進度']] ?? '').trim(),
      insurance_progress: String(row[index['保險進度']] ?? '').trim(),
    };
    if (monthlyIndex !== undefined) record.monthly_progress = String(row[monthlyIndex] ?? '').trim();
    return record;
  }).filter((record) => record.branch && record.advisor_name);
}

async function loadXlsx() {
  return import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
}

async function parsePerformanceFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'csv') return recordsFromRows(parseCsvRows(await file.text()));
  if (extension === 'xlsx') {
    const XLSX = await loadXlsx();
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('Excel 檔沒有工作表。');
    return recordsFromRows(XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false }));
  }
  throw new Error('僅支援 .xlsx 與 .csv 檔案。');
}

function formatAmount(value) {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(Math.round((value + Number.EPSILON) * 100) / 100);
}

async function parseQuarterRawFile(file) {
  if (file.name.split('.').pop()?.toLowerCase() !== 'xlsx') throw new Error('季職達原始檔僅支援 .xlsx。');
  const XLSX = await loadXlsx();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Excel 檔沒有工作表。');
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: true });
  const sourceDate = String(worksheet.A3?.v ?? '').trim();
  if (!sourceDate) throw new Error('找不到 A3 的資料日期。');

  const personByName = new Map(people.map((person) => [normalizeAdvisorName(person.name), person]));
  const records = [];
  for (const row of rows.slice(10)) {
    const person = personByName.get(normalizeAdvisorName(row[5]));
    if (!person) continue;
    const quarterTarget = asNumber(row[9]) * 3;
    const quarterProgress = asNumber(row[59]) + asNumber(row[39]) + asNumber(row[40]);
    const monthlyProgress = asNumber(row[41]);
    const insuranceProgress = asNumber(row[40]) + asNumber(row[56]);
    const current = performance[key(person.branch, person.name)] || {};
    records.push({
      branch: person.branch,
      advisor_name: person.name,
      quarter_target: formatAmount(quarterTarget),
      quarter_progress: formatAmount(quarterProgress),
      monthly_progress: formatAmount(monthlyProgress),
      quarter_rate: formatRate(quarterProgress, quarterTarget),
      fund_progress: current.fundProgress || '',
      insurance_progress: formatAmount(insuranceProgress / 10_000),
      source_date: sourceDate,
    });
  }
  const matchedNames = new Set(records.map((record) => record.advisor_name));
  const missing = people.filter((person) => !matchedNames.has(person.name));
  if (missing.length) throw new Error(`原始檔自第 11 列起缺少 ${missing.length} 位人員：${missing.map((person) => person.name).join('、')}`);
  return { sourceDate, records };
}

async function uploadRecords(records, progressMessage) {
  if (!records.length) throw new Error('找不到可上傳的績效資料。');
  setUploadMessage(progressMessage);
  const { error } = await supabase.from('performance_records').upsert(records, { onConflict: 'branch,advisor_name' });
  if (error && String(error.message || '').includes('monthly_progress')) {
    throw new Error('尚未建立 AP 月進度欄位，請先執行 supabase/monthly-progress.sql。');
  }
  if (error) throw error;
}

async function uploadQuarterRawFile(file) {
  if (!supabase || !currentUser || !canWrite || busy) return;
  setBusy(true);
  try {
    setUploadMessage('正在讀取季職達原始檔…');
    const { sourceDate, records } = await parseQuarterRawFile(file);
    await uploadRecords(records, `正在以 ${sourceDate} 更新 ${records.length} 位人員…`);
    setBusy(false);
    await loadPerformance({ announce: false });
    setUploadMessage(`更新完成：已用 ${sourceDate} 的原始檔更新 ${records.length} 位人員。`, 'success');
  } catch (error) {
    setUploadMessage(`上傳失敗：${error.message || '請確認 Excel 格式。'}`, 'error');
  } finally {
    $('raw-file').value = '';
    setBusy(false);
  }
}

async function uploadPerformanceFile(file) {
  if (!supabase || !currentUser || !canWrite || busy) return;
  setBusy(true);
  try {
    setUploadMessage('正在檢查 Excel／CSV…');
    const records = await parsePerformanceFile(file);
    const permitted = new Set(people.map((person) => key(person.branch, person.name)));
    const invalid = records.filter((record) => !permitted.has(key(record.branch, record.advisor_name)));
    if (invalid.length) throw new Error(`有 ${invalid.length} 筆不在固定名單內：${invalid.slice(0, 3).map((item) => item.advisor_name).join('、')}`);
    const recordsWithSourceDate = records.map((record) => ({
      ...record,
      source_date: performance[key(record.branch, record.advisor_name)]?.sourceDate || '',
    }));
    await uploadRecords(recordsWithSourceDate, `正在寫入 ${recordsWithSourceDate.length} 筆雲端實績…`);
    setBusy(false);
    await loadPerformance({ announce: false });
    setUploadMessage(`更新完成：已寫入 ${recordsWithSourceDate.length} 筆實績。`, 'success');
  } catch (error) {
    setUploadMessage(`上傳失敗：${error.message || '請確認檔案格式。'}`, 'error');
  } finally {
    $('performance-file').value = '';
    setBusy(false);
  }
}

async function signInWithPassword(email, password, messageNode) {
  if (!email || !password) {
    messageNode.textContent = '請輸入帳號與密碼。';
    return;
  }
  messageNode.textContent = '正在驗證…';
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    messageNode.textContent = `登入失敗：${error.message}`;
    return;
  }
  messageNode.textContent = '';
  $('login-dialog').close();
  await applySession(data.session);
}

function setupDialogs() {
  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog').close());
  });
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      const bounds = dialog.getBoundingClientRect();
      const isBackdrop = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
      if (isBackdrop) dialog.close();
    });
  });
}

function setupEvents() {
  $('login-button').addEventListener('click', () => {
    $('login-dialog').showModal();
    requestAnimationFrame(() => (hasManagerUploadAccount ? $('manager-password') : $('email')).focus());
  });
  $('manage-button').addEventListener('click', () => $('manage-dialog').showModal());
  $('refresh-button').addEventListener('click', () => void loadPerformance());
  $('dialog-sync-button').addEventListener('click', () => void loadPerformance());
  $('raw-file').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) void uploadQuarterRawFile(file);
  });
  $('performance-file').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) void uploadPerformanceFile(file);
  });
  $('manager-login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    void signInWithPassword(String(config.uploadAccountEmail), $('manager-password').value, $('manager-login-message'));
  });
  $('account-login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    void signInWithPassword($('email').value.trim(), $('password').value, $('account-login-message'));
  });
  $('signout-button').addEventListener('click', async () => {
    await supabase.auth.signOut();
    await applySession(null);
  });
  $('team-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-team-tab]');
    if (!button) return;
    selectedTeam = button.dataset.teamTab;
    document.querySelectorAll('[data-team-tab]').forEach((tab) => tab.setAttribute('aria-selected', String(tab === button)));
    renderRosters();
  });
}

async function init() {
  render();
  setupDialogs();
  setupEvents();
  $('manager-login-form').hidden = !hasManagerUploadAccount;
  $('login-divider').hidden = !hasManagerUploadAccount;
  $('manager-email').value = hasManagerUploadAccount ? String(config.uploadAccountEmail) : '';
  setBusy(false);

  if (!isConfigured) {
    $('login-button').disabled = true;
    setCloudState('尚未設定雲端', 'error');
    setStatus('尚未設定 Supabase，請先完成 config.js 連線資訊。', 'error');
    return;
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    supabase = createClient(config.url, config.anonKey);
    supabase.auth.onAuthStateChange((_event, session) => { void applySession(session); });
    const { data: { session } } = await supabase.auth.getSession();
    await applySession(session);
  } catch (error) {
    $('login-button').disabled = true;
    setCloudState('雲端連線失敗', 'error');
    setStatus(`無法連接績效系統：${error.message || '請檢查網路後重新整理。'}`, 'error');
  }
}

void init();
