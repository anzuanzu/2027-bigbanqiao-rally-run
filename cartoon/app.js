const people = [
  ['A','板橋分行','SRM1','溫志剛',25000000],['A','板橋分行','SRM1','李宗杰',15000000],['A','板橋分行','SRM1','周韻如',15000000],['A','板橋分行','SRM1','吳采妍',11000000],['A','華江分行','SRM2','黃柏飛',10000000],['A','新板分行','RM1','周至浩',10000000],['A','新板分行','SRM2','郭淑芬',10000000],['A','新板分行','RM2','盧品豪',5000000],['A','新板分行','RM2','王泓權',1000000],
  ['B','板橋分行','SRM1','許凱婷',25000000],['B','板橋分行','SRM1','宋柏陞',15000000],['B','板橋分行','JRM','洪易佳',5000000],['B','華江分行','SRM1','廖敏慧',15000000],['B','華江分行','SRM1','詹采榆',12500000],['B','新板分行','SRM2','林靜芸',10000000],['B','新板分行','RM1','詹忠儒',10000000],['B','新板分行','SRM2','艾祺倫',10000000],
  ['C','板橋分行','SRM1','張瓊月',15000000],['C','板橋分行','SRM1','宋婷婷',15000000],['C','板橋分行','SRM2','李承紘',9000000],['C','華江分行','SRM2','施雯晴',10000000],['C','華江分行','RM1','徐小凡',10000000],['C','新板分行','SRM1','黃淑卿',20000000],['C','新板分行','RM1','陳奕憲',15000000],['C','新板分行','SRM1','朱麗鳳',10000000],
  ['HRM','新板分行','HRM','楊璧菁',30000000],
].map(([team,branch,level,name,target])=>({team,branch,level,name,target}));

const teams = [
  {id:'A',label:'A 隊',name:'火焰衝鋒隊',color:'#f05b61',head:'white'},
  {id:'B',label:'B 隊',name:'閃電追風隊',color:'#f6b83f',head:'#183153'},
  {id:'C',label:'C 隊',name:'森林疾風隊',color:'#35b98b',head:'white'},
];
const config=window.SUPABASE_CONFIG||{};
const isConfigured=Boolean(config.url&&config.anonKey&&String(config.url).startsWith('https://'));
const hasManagerUploadAccount=Boolean(config.uploadAccountEmail&&String(config.uploadAccountEmail).includes('@'));
const branchTargetRecordName='__分行季目標__';
const $=id=>document.getElementById(id);
let supabase=null,currentUser=null,canWrite=false,hasLoaded=false,hasMonthlyProgress=false,performance={},selectedTeam='all',busy=false;
let cheerDate=taipeiDate(),cheerRecords=[],cheerMode='connecting',visitorId=getVisitorId(),cheerBusy=false,cheerToastTimer=0;
let cheerReadSequence=0,sessionSequence=0,loginBusy=false,authSessionTimer=0;
const fontSizeScales={small:.9,standard:1,large:1.15};
let fontSizeSetting=readFontSizeSetting();
let motionSetting=readMotionSetting(),raceInView=true;
const reducedMotionQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');
const cheerAnimationTimers=new Map(),cheerAnimationFrames=new Map();

const key=(branch,name)=>`${branch}-${name}`;
const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function num(value){const n=typeof value==='number'?value:Number(String(value??'').replace(/,/g,'').replace(/%/g,''));return Number.isFinite(n)?n:0;}
function money(value){const n=num(value);return n>=100000000?`${(n/100000000).toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:3})} 億`:`${(n/10000).toLocaleString('zh-TW',{maximumFractionDigits:1})} 萬`;}
function rate(progress,target){return target>0?progress/target*100:0;}
function rateText(progress,target){return target>0?`${rate(progress,target).toFixed(1)}%`:'—';}
function personProgress(person){return num(performance[key(person.branch,person.name)]?.quarterProgress);}
function personMonthlyProgress(person){return num(performance[key(person.branch,person.name)]?.monthlyProgress);}
function stats(teamId){const members=people.filter(p=>p.team===teamId),target=members.reduce((s,p)=>s+p.target,0),progress=members.reduce((s,p)=>s+personProgress(p),0);return{members,target,progress,rate:rate(progress,target)};}
function rankedTeamProgress(progressForPerson,targetForTeam){return teams.map(team=>{const value=people.filter(person=>person.team===team.id).reduce((sum,person)=>sum+progressForPerson(person),0),target=targetForTeam(team);return{team,value,target,rate:rate(value,target)};}).sort((a,b)=>b.rate-a.rate||b.value-a.value||a.team.id.localeCompare(b.team.id));}
function ranking(){if(!hasLoaded)return teams.map(t=>({...t,...stats(t.id),rank:null}));return teams.map(t=>({...t,...stats(t.id)})).sort((a,b)=>b.rate-a.rate||b.progress-a.progress||a.id.localeCompare(b.id)).map((t,i)=>({...t,rank:i+1}));}
function sourceDates(){return[...new Set(Object.values(performance).map(r=>String(r.sourceDate||'').replace(/^(?:資料日期\s*[:：]?\s*)+/,'').trim()).filter(Boolean))];}
function taipeiDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function createVisitorId(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,char=>{const value=Math.random()*16|0,result=char==='x'?value:(value&3|8);return result.toString(16);});}
function getVisitorId(){try{const saved=localStorage.getItem('big-banqiao-cheer-visitor');if(saved)return saved;const created=window.crypto?.randomUUID?.()||createVisitorId();localStorage.setItem('big-banqiao-cheer-visitor',created);return created;}catch{return createVisitorId();}}
function readFontSizeSetting(){try{const saved=localStorage.getItem('big-banqiao-font-size');return Object.hasOwn(fontSizeScales,saved)?saved:'standard';}catch{return'standard';}}
function applyFontSize(size=fontSizeSetting,{persist=false}={}){
  fontSizeSetting=Object.hasOwn(fontSizeScales,size)?size:'standard';
  document.documentElement.dataset.fontSize=fontSizeSetting;
  if(persist)try{localStorage.setItem('big-banqiao-font-size',fontSizeSetting);}catch{}
  document.querySelectorAll('button[data-font-size]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fontSize===fontSizeSetting)));
}
function readMotionSetting(){try{return localStorage.getItem('big-banqiao-motion')==='reduced'?'reduced':'full';}catch{return'full';}}
function applyMotionSetting({persist=false}={}){
  const systemReduced=Boolean(reducedMotionQuery?.matches),reduced=systemReduced||motionSetting==='reduced';
  document.documentElement.dataset.motion=reduced?'reduced':'full';
  const button=$('motion-toggle');
  if(button){button.textContent=reduced?'動畫：減少':'動畫：標準';button.setAttribute('aria-pressed',String(reduced));button.disabled=systemReduced;button.title=systemReduced?'目前依照裝置的「減少動態效果」設定。':'切換跑者、火焰與應援動畫。';}
  if(persist)try{localStorage.setItem('big-banqiao-motion',motionSetting);}catch{}
}
function updateRaceMotion(){document.documentElement.dataset.racePaused=String(document.hidden||!raceInView);}
function setupMotion(){
  applyMotionSetting();updateRaceMotion();
  $('motion-toggle')?.addEventListener('click',()=>{motionSetting=motionSetting==='reduced'?'full':'reduced';applyMotionSetting({persist:true});});
  if(reducedMotionQuery?.addEventListener)reducedMotionQuery.addEventListener('change',()=>applyMotionSetting());
  else reducedMotionQuery?.addListener?.(()=>applyMotionSetting());
  if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{raceInView=entries.some(entry=>entry.isIntersecting);updateRaceMotion();},{rootMargin:'100px'});observer.observe($('raceboard'));}
  const atlas=new Image();
  atlas.onload=()=>{document.documentElement.dataset.runnerSprites='ready';};
  atlas.onerror=()=>{delete document.documentElement.dataset.runnerSprites;};
  atlas.src='assets/runner-sprites.png';
}
function localCheerKey(){return`big-banqiao-cheers-v2-${cheerDate}`;}
function readLocalCheers(){try{const value=JSON.parse(localStorage.getItem(localCheerKey())||'[]');return Array.isArray(value)?value.filter(r=>r.visitor_id&&teams.some(t=>t.id===r.team)):[];}catch{return[];}}
function writeLocalCheers(){localStorage.setItem(localCheerKey(),JSON.stringify(cheerRecords));}
function cheerCount(teamId){return cheerRecords.filter(r=>r.team===teamId).length;}
function ownCheer(){return cheerRecords.find(record=>record.visitor_id===visitorId);}
function renderCheerMode(){
  const node=$('cheer-mode');if(!node)return;
  const states={cloud:['is-cloud','● 雲端共用・每 30 秒同步'],connecting:['is-connecting','● 應援連線中'],retry:['is-retry','● 暫時離線・等待重新同步'],local:['is-local','● 本機模式']};
  const [state,label]=states[cheerMode]||states.connecting;
  node.textContent=label;node.className=`cheer-status ${state}`;
}
const fireScaleSteps=[0,.34,.39,.45,.51,.57,.64,.72,.8,.88,.97,1.06,1.16,1.26,1.37,1.48,1.6,1.72,1.85,1.98,2.12,2.26,2.41,2.57,2.74,2.92,3.12];
function fireState(level){const capped=Math.max(0,Math.min(Math.floor(num(level)),26));return{level:capped,tier:capped===26?'max':capped>=20?'ultra':capped>=14?'surge':capped>=7?'hot':'ember',heat:(capped/26).toFixed(3),scale:fireScaleSteps[capped],flicker:Math.max(250,620-capped*13),glow:(6+capped*.72).toFixed(1)};}
function flame(level){const state=fireState(level);return`<span class="boost-fire ${state.level?'is-lit':''} heat-${state.tier} level-${state.level}" style="--heat:${state.heat};--fire-scale:${state.scale};--flicker:${state.flicker}ms;--fire-glow:${state.glow}px" aria-hidden="true"><span class="fire-visual"><i class="fire-aura"></i><svg class="flame-art" viewBox="0 0 120 80" focusable="false"><path class="flame-outer" d="M118 40C101 18 84 8 64 18C49 26 45 7 14 5C30 20 34 31 5 40C31 49 28 61 14 75C45 72 50 53 66 63C87 72 102 59 118 40Z"/><path class="flame-middle" d="M118 40C98 24 80 20 58 29C45 34 39 25 25 20C33 31 31 36 13 40C34 45 38 51 28 62C47 56 56 49 70 55C90 61 103 52 118 40Z"/><path class="flame-core" d="M118 40C96 29 78 30 60 36C48 39 42 35 32 32C37 39 37 42 31 48C51 45 64 52 81 49C98 47 109 43 118 40Z"/></svg><i class="fire-streak one"></i><i class="fire-streak two"></i><i class="fire-streak three"></i><i class="fire-spark one"></i><i class="fire-spark two"></i><i class="fire-spark three"></i><i class="fire-spark four"></i></span></span>`;}
function updateFlame(node,level){
  const state=fireState(level);
  node.className=`boost-fire ${state.level?'is-lit ':''}heat-${state.tier} level-${state.level}`;
  const properties={'--heat':state.heat,'--fire-scale':String(state.scale),'--flicker':`${state.flicker}ms`,'--fire-glow':`${state.glow}px`};
  for(const[property,value]of Object.entries(properties))if(node.style.getPropertyValue(property)!==value)node.style.setProperty(property,value);
}

function runner(teamId){return`<span class="runner-body"><img class="runner-img" src="assets/team-${teamId.toLowerCase()}-runner.png" width="700" height="605" decoding="async" alt="${teamId} 隊熱血跑者"><span class="runner-sprite" data-team="${teamId}" style="--sprite-row:${teams.findIndex(team=>team.id===teamId)*50}%" aria-hidden="true"></span></span>`;}
function setText(node,value){if(node.textContent!==value)node.textContent=value;}
function renderRace(){
  const ranked=ranking(),rankMap=new Map(ranked.map(t=>[t.id,t.rank])),mine=ownCheer();
  const board=$('raceboard');
  // Keep the animated nodes alive across cloud refreshes so frames, focus and scale transitions continue.
  if(!board.querySelector('[data-team-lane]'))board.innerHTML=teams.map(team=>`<article class="race-lane" data-team-lane="${team.id}" style="--team:${team.color};--label-color:${team.head}">
    <button class="lane-label" type="button" data-cheer-team="${team.id}"><b>${team.id}</b><span>${team.name}</span><small></small></button>
    <div class="race-track"><div class="runner-wrap" style="--race-progress:0">${flame(0)}<span class="runner-dust" aria-hidden="true"><i></i><i></i><i></i></span><span class="cheer-shockwave" aria-hidden="true"></span>${runner(team.id)}<span class="cheer-feedback" aria-hidden="true" hidden></span></div><span class="finish" aria-hidden="true">FINISH</span></div>
    <div class="lane-stats"><b></b><span></span></div><span class="lane-status"></span><span class="confetti" aria-hidden="true" hidden><i></i><i></i><i></i></span>
  </article>`).join('');
  for(const team of teams){
    const lane=board.querySelector(`[data-team-lane="${team.id}"]`),s=stats(team.id),rank=rankMap.get(team.id),progress=Math.max(0,Math.min(s.rate,100))/100,finished=hasLoaded&&s.rate>=100,cheers=cheerCount(team.id),level=fireState(cheers).level;
    const button=lane.querySelector('[data-cheer-team]'),status=lane.querySelector('.lane-status');
    lane.dataset.fireLevel=String(level);
    button.classList.toggle('is-my-cheer',mine?.team===team.id);
    button.setAttribute('aria-busy',String(cheerBusy));
    const label=`${mine?`今天已替 ${mine.team} 隊加油；`:''}替 ${team.label} 加油，目前 ${cheers} 人，火力 ${level} 級`;
    if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
    setText(button.querySelector('small'),`${mine?.team===team.id?'✓ 今日已加油':mine?'今日已應援':'🔥 點我加油'}・Lv.${level}`);
    lane.querySelector('.runner-wrap').style.setProperty('--race-progress',String(progress));
    updateFlame(lane.querySelector('.boost-fire'),cheers);
    setText(lane.querySelector('.lane-stats b'),hasLoaded?`${s.rate.toFixed(1)}%`:'—');
    setText(lane.querySelector('.lane-stats span'),`${hasLoaded?money(s.progress):'進度待同步'} / ${money(s.target)}`);
    setText(status,!hasLoaded?'等待同步':finished?'完賽！':rank===1?'領先中':s.rate>=80?'最後衝刺':'全速前進');
    status.classList.toggle('leader',rank===1);status.classList.toggle('finished',finished);
    lane.querySelector('.confetti').hidden=!finished;
  }
  $('podium').innerHTML=ranked.map((team,index)=>`<article class="podium-card ${index===0&&hasLoaded?'first':''}"><span class="podium-place">${hasLoaded?index+1:'?'}</span><p><b>${team.label}・${team.name}</b><span>${team.members.length} 位選手・目標 ${money(team.target)}</span></p><strong>${hasLoaded?`${team.rate.toFixed(1)}%`:'—'}</strong></article>`).join('');
}

function playerScore(person){const progress=personProgress(person);if(!hasLoaded)return'<b>—</b><span>尚未同步</span>';const diff=progress-person.target;return`<b>${money(progress)}</b><span class="${diff>=0?'go':'wait'}">${diff>=0?'已達標':`差 ${money(Math.abs(diff))}`}</span>`;}
function renderPlayers(){
  $('player-cards').innerHTML=teams.map(team=>{const s=stats(team.id),visible=selectedTeam==='all'||selectedTeam===team.id;return`<article class="team-card ${visible?'':'is-hidden'}" data-team-card="${team.id}" style="--team:${team.color};--head-color:${team.head}">
    <header class="team-card-head"><span class="team-avatar">${team.id}</span><div><b>${team.name}</b><small>${s.members.length} 位跨分行選手</small></div><span class="team-total"><strong>${(s.target/10000).toLocaleString('zh-TW')}</strong><small>萬目標</small></span></header>
    <button class="team-intro-link" type="button" data-intro-team="${team.id}" aria-label="播放 ${team.label} 隊員介紹" aria-haspopup="dialog" aria-controls="team-intro-dialog"><span aria-hidden="true">▶</span> 播放隊員介紹 <span class="intro-link-note">${s.members.length} 位夥伴登場</span></button>
    <ol class="players">${s.members.map((p,i)=>`<li class="player"><span class="player-number">${String(i+1).padStart(2,'0')}</span><span class="player-info"><b>${esc(p.name)}</b><span>${esc(p.branch.replace('分行',''))}・${esc(p.level)}・目標 ${money(p.target)}</span></span><span class="player-score">${playerScore(p)}</span></li>`).join('')}</ol>
    <footer class="team-card-foot"><span>全隊達成率</span><b>${hasLoaded?rateText(s.progress,s.target):'待同步'}</b></footer>
  </article>`}).join('');
}
function renderHrm(){const p=people.find(x=>x.team==='HRM'),progress=personProgress(p),pct=rate(progress,p.target);$('hrm-bar').style.width=`${hasLoaded?Math.min(pct,100):0}%`;$('hrm-badge').textContent=hasLoaded?`${pct.toFixed(1)}%`:'—';$('hrm-progress').textContent=hasLoaded?`${money(progress)} / ${money(p.target)}${pct>=100?'・挑戰成功！':''}`:'戰況連線後顯示季進度（含在途）';}
function renderTeamRewardRanking(nodeId,ranked,{ready,emptyMessage,targetLabel}){const node=$(nodeId);if(!ready){node.innerHTML=`<li class="reward-empty">${emptyMessage}</li>`;return;}node.innerHTML=ranked.map(({team,value,target,rate:teamRate},index)=>{const s=stats(team.id);return`<li class="${index===0?'winner':''}" style="--rank-team:${team.color}"><span class="rank-number">${index+1}</span><p><b>${team.label}・${team.name}</b><small>${s.members.length} 位選手・${targetLabel} ${money(target)}</small></p><strong>${teamRate.toFixed(1)}%<small>${money(value)} / ${money(target)}</small></strong></li>`;}).join('');}
function milestoneTier(progress){if(progress>=50000000)return{label:'5K',reward:'餐券 8 張',level:'max'};if(progress>=40000000)return{label:'4K',reward:'餐券 4 張',level:'high'};if(progress>=30000000)return{label:'3K',reward:'餐券 2 張',level:'hit'};return{label:'挑戰中',reward:`距 3K ${money(Math.max(30000000-progress,0))}`,level:'wait'};}
function renderRewards(){
  renderTeamRewardRanking('monthly-team-ranking',rankedTeamProgress(personMonthlyProgress,team=>stats(team.id).target),{ready:hasLoaded&&hasMonthlyProgress,emptyMessage:hasLoaded?'月進度資料尚未齊全，待管理者補齊後顯示排名。':'戰況連線後顯示每月團隊排名。',targetLabel:'開門紅責任目標'});
  renderTeamRewardRanking('champion-team-ranking',rankedTeamProgress(personProgress,team=>stats(team.id).target),{ready:hasLoaded,emptyMessage:'戰況連線後顯示季進度總冠軍排名。',targetLabel:'開門紅目標'});
  const node=$('personal-milestone-ranking');if(!hasLoaded){node.innerHTML='<p class="reward-empty">戰況連線後顯示 26 位人員的 3K／4K／5K 即時進度。</p>';return;}
  const ranked=people.map(person=>({person,progress:personProgress(person)})).sort((a,b)=>b.progress-a.progress||a.person.name.localeCompare(b.person.name,'zh-TW')),achieved=ranked.filter(item=>item.progress>=30000000).length;
  node.innerHTML=`<div class="milestone-summary"><b>目前 ${achieved} 人達標</b><span>依季進度（含在途）排序</span></div><ol>${ranked.map(({person,progress},index)=>{const tier=milestoneTier(progress);return`<li><span class="rank-number">${index+1}</span><p><b>${esc(person.name)}</b><small>${person.team==='HRM'?'HRM':`${person.team} 隊`}・${esc(person.branch.replace('分行',''))}</small></p><strong>${money(progress)}<small class="milestone-badge ${tier.level}">${tier.label}・${tier.reward}</small></strong></li>`;}).join('')}</ol>`;
}
function renderOverall(){const target=people.reduce((s,p)=>s+p.target,0),progress=people.reduce((s,p)=>s+personProgress(p),0);$('overall-progress').textContent=hasLoaded?money(progress):'—';$('overall-rate').textContent=hasLoaded?rateText(progress,target):'—';const dates=sourceDates();$('source-date').textContent=dates.length?`資料日期 ${dates.join('、')}`:hasLoaded?'雲端戰況已同步':'戰況尚未同步';}
function renderCountdown(){const now=new Date(),start=new Date('2026-11-01T00:00:00+08:00'),end=new Date('2027-02-28T23:59:59+08:00'),day=86400000;$('countdown').textContent=now<start?`距離開賽 ${Math.ceil((start-now)/day)} 天`:now<=end?`賽程倒數 ${Math.max(1,Math.ceil((end-now)/day))} 天`:'本屆賽事已結束';}
function render(){renderCountdown();renderOverall();renderRace();renderPlayers();renderHrm();renderRewards();renderCheerMode();applyFontSize();}

function setStatus(message,tone=''){$('status-message').textContent=message;$('status-message').className=`status-line ${tone}`;}
function setUpload(message,tone=''){$('upload-message').textContent=message;$('upload-message').className=`upload-message ${tone}`;}
function setCloud(message,tone=''){$('cloud-state').className=`cloud-pill ${tone}`;$('cloud-state').querySelector('span').textContent=message;}
function setBusy(value){busy=value;$('dialog-sync-button').disabled=value;$('raw-file').disabled=value||!canWrite;$('monthly-file').disabled=value||!canWrite;$('performance-file').disabled=value||!canWrite;$('raw-file-label').classList.toggle('is-disabled',value||!canWrite);$('monthly-file-label').classList.toggle('is-disabled',value||!canWrite);$('performance-file-label').classList.toggle('is-disabled',value||!canWrite);$('refresh-button').disabled=value;$('manage-button').disabled=value;}
function recordMap(records){return Object.fromEntries(records.map(r=>[key(r.branch,r.advisor_name),{quarterTarget:r.quarter_target,quarterProgress:r.quarter_progress,monthlyProgress:r.monthly_progress,quarterRate:r.quarter_rate,fundProgress:r.fund_progress,insuranceProgress:r.insurance_progress,sourceDate:r.source_date||''}]));}

function showCheerToast(message,tone='success'){const toast=$('cheer-toast');clearTimeout(cheerToastTimer);toast.textContent=message;toast.className=`cheer-toast ${tone}`;toast.hidden=false;cheerToastTimer=setTimeout(()=>{toast.hidden=true;},2600);}
function animateCheer(teamId,{atMax=false}={}){
  const lane=document.querySelector(`[data-team-lane="${teamId}"]`);if(!lane)return;
  clearTimeout(cheerAnimationTimers.get(teamId));cancelAnimationFrame(cheerAnimationFrames.get(teamId));
  const feedback=lane.querySelector('.cheer-feedback');
  feedback.textContent=atMax?'滿級應援！':'火力 +1';feedback.hidden=false;
  lane.classList.remove('cheer-bursting');
  cheerAnimationFrames.set(teamId,requestAnimationFrame(()=>{lane.classList.add('cheer-bursting');cheerAnimationFrames.delete(teamId);}));
  cheerAnimationTimers.set(teamId,setTimeout(()=>{lane.classList.remove('cheer-bursting');feedback.hidden=true;cheerAnimationTimers.delete(teamId);},1100));
}
async function loadCheers({quiet=false}={}){
  const today=taipeiDate();
  if(today!==cheerDate){cheerDate=today;cheerRecords=[];}
  const requestDate=cheerDate,requestId=++cheerReadSequence;
  if(!isConfigured){cheerMode='local';cheerRecords=readLocalCheers();renderRace();renderCheerMode();return true;}
  if(!supabase){cheerMode='connecting';renderRace();renderCheerMode();return false;}
  try{
    const{data,error}=await supabase.from('team_cheers').select('visitor_id, team').eq('cheer_date',requestDate);
    if(requestId!==cheerReadSequence)return false;
    if(requestDate!==taipeiDate()){
      cheerDate=taipeiDate();cheerRecords=[];cheerMode='connecting';renderRace();renderCheerMode();return false;
    }
    if(error)throw error;
    if(!Array.isArray(data))throw new Error('應援資料格式不完整。');
    cheerRecords=data;cheerMode='cloud';renderRace();renderCheerMode();return true;
  }catch(error){
    if(requestId!==cheerReadSequence)return false;
    if(requestDate!==taipeiDate()){cheerDate=taipeiDate();cheerRecords=[];}
    cheerMode='retry';renderRace();renderCheerMode();
    if(!quiet)console.info('每日應援尚未同步：',error.message||error);
    return false;
  }
}
async function submitCheer(teamId){
  const team=teams.find(item=>item.id===teamId);if(!team||cheerBusy)return;
  cheerBusy=true;
  document.querySelectorAll('[data-cheer-team]').forEach(button=>button.setAttribute('aria-busy','true'));
  try{
    if(!await loadCheers({quiet:true}))throw new Error('目前無法同步，這次加油尚未送出，請稍後再試。');
    const existing=ownCheer();
    if(existing){showCheerToast(`今天已替 ${existing.team} 隊加油，明天再來！`,'notice');return;}
    const submittedDate=cheerDate,previousCount=cheerCount(teamId);
    if(isConfigured){
      const{error}=await supabase.from('team_cheers').insert({cheer_date:submittedDate,visitor_id:visitorId,team:teamId});
      if(error)throw error;
      if(submittedDate===taipeiDate())cheerRecords.push({visitor_id:visitorId,team:teamId});
      await loadCheers({quiet:true});
    }else{cheerRecords.push({visitor_id:visitorId,team:teamId});writeLocalCheers();renderRace();}
    if(submittedDate!==cheerDate){showCheerToast('加油已送出！已進入新的一天，可再送出今日應援。');return;}
    animateCheer(teamId,{atMax:previousCount>=26});
    showCheerToast(previousCount>=26?`🔥 已替 ${team.label} 加油！火力已達最高 26 級。`:`🔥 成功替 ${team.label} 增加一級火力！`);
  }catch(error){
    if(error.code==='23505'){await loadCheers({quiet:true});showCheerToast('今天已經加油過了，明天再來！','notice');}
    else showCheerToast(`加油失敗：${error.message||'請稍後再試。'}`,'error');
  }finally{cheerBusy=false;document.querySelectorAll('[data-cheer-team]').forEach(button=>button.setAttribute('aria-busy','false'));}
}
async function refreshCheerDay(){if(document.hidden||cheerBusy)return;await loadCheers({quiet:true});}

async function fetchPerformanceRecords(){return supabase.rpc('get_public_rally_performance');}
function validProgress(value){
  if(typeof value==='number')return Number.isFinite(value);
  if(typeof value!=='string'||!value.trim()||!/[0-9]/.test(value))return false;
  return Number.isFinite(Number(value.replace(/,/g,'').trim()));
}
async function loadPerformance({announce=true}={}){
  if(!supabase||busy)return;
  setBusy(true);if(announce)setStatus('裁判正在同步最新戰況…');
  try{
    const{data,error}=await fetchPerformanceRecords();
    if(error)throw error;
    if(!Array.isArray(data))throw new Error('雲端回傳的戰況格式不完整。');
    const permitted=new Set(people.map(person=>key(person.branch,person.name)));
    const matched=data.filter(record=>permitted.has(key(record.branch,record.advisor_name)));
    const next=recordMap(matched);
    const missing=people.filter(person=>!validProgress(next[key(person.branch,person.name)]?.quarterProgress));
    if(missing.length)throw new Error(`有 ${missing.length} 位選手缺少有效季進度：${missing.map(person=>person.name).join('、')}。`);
    performance=next;hasLoaded=true;
    hasMonthlyProgress=people.filter(person=>person.team!=='HRM').every(person=>validProgress(next[key(person.branch,person.name)]?.monthlyProgress));
    const dates=sourceDates(),extraCount=data.length-matched.length;
    const monthlyNote=hasMonthlyProgress?'AP 月進度已完整同步。':'AP 月進度不完整，暫不顯示每月名次。';
    const countNote=`已同步 ${Object.keys(next).length}／${people.length} 位參賽者${extraCount?`，另略過 ${extraCount} 筆非參賽資料`:''}。`;
    setStatus(`${countNote}${dates.length?`資料日期：${dates.join('、')}。`:''}${monthlyNote}`,hasMonthlyProgress?'success':'warning');
    setUpload(`${countNote}${monthlyNote}`,hasMonthlyProgress?'success':'warning');render();
  }catch(error){
    const retained=hasLoaded?'目前保留上次完整戰況，尚未取得最新更新。':'尚未取得完整戰況，暫不顯示排名。';
    const message=`同步失敗：${error.message||'請稍後再試。'} ${retained}`;
    setStatus(message,'error');setUpload(message,'error');
  }finally{setBusy(false);}
}
async function applySession(session){
  const requestId=++sessionSequence;
  currentUser=session?.user||null;canWrite=false;
  $('login-button').hidden=true;$('manage-button').hidden=false;$('signout-button').hidden=!currentUser;
  setBusy(busy);
  if(!currentUser){setCloud('公開戰況','success');return false;}
  try{
    if(!supabase)throw new Error('雲端連線尚未完成。');
    setCloud('管理權限驗證中…');
    const{data:role,error}=await supabase.rpc('my_performance_role');
    if(requestId!==sessionSequence)return false;
    if(error)throw error;
    canWrite=['admin','editor'].includes(role);
    setCloud(canWrite?'管理驗證完成':'公開戰況・無上傳權限',canWrite?'success':'');
    if(!canWrite)setStatus('此帳號可觀看公開戰況；上傳資料需使用管理帳號。');
    setBusy(busy);return canWrite;
  }catch(error){
    if(requestId!==sessionSequence)return false;
    setCloud('公開戰況・驗證失敗','error');
    setStatus(`目前可觀看公開戰況；管理驗證失敗：${error.message||'請稍後再試。'}`,'error');
    setBusy(busy);return false;
  }
}

function normalizeHeader(value){return String(value??'').replace(/^\uFEFF/,'').replace(/[（）]/g,c=>c==='（'?'(':')').replace(/\s/g,'').trim();}
function normalizeName(value){return String(value??'').replace(/\s/g,'').trim();}
function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i],next=text[i+1];if(c==='"'&&quoted&&next==='"'){cell+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;}
function recordsFromRows(rows){const[headers,...data]=rows;if(!headers)throw new Error('找不到欄位標題。');const idx=Object.fromEntries(headers.map((h,i)=>[normalizeHeader(h),i])),required=['分行','理專姓名','季責任額','季進度(含在途)','季達成率','基金進度','保險進度'],monthlyIndex=idx['月進度']??idx['每月進度']??idx['個人成績(AP)'];if(required.some(h=>idx[h]===undefined))throw new Error('檔案欄位不完整，請使用標準績效欄位。');return data.map(row=>{const record={branch:String(row[idx['分行']]??'').trim(),advisor_name:normalizeName(row[idx['理專姓名']]),quarter_target:String(row[idx['季責任額']]??'').trim(),quarter_progress:String(row[idx['季進度(含在途)']]??'').trim(),quarter_rate:String(row[idx['季達成率']]??'').trim(),fund_progress:String(row[idx['基金進度']]??'').trim(),insurance_progress:String(row[idx['保險進度']]??'').trim()};if(monthlyIndex!==undefined)record.monthly_progress=String(row[monthlyIndex]??'').trim();return record;}).filter(r=>r.branch&&r.advisor_name);}
async function xlsx(){return import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');}
async function parsePerformanceFile(file){const ext=file.name.split('.').pop()?.toLowerCase();if(ext==='csv')return recordsFromRows(parseCsv(await file.text()));if(ext==='xlsx'){const XLSX=await xlsx(),book=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheet=book.SheetNames[0];if(!sheet)throw new Error('Excel 檔沒有工作表。');return recordsFromRows(XLSX.utils.sheet_to_json(book.Sheets[sheet],{header:1,defval:'',raw:false}));}throw new Error('僅支援 .xlsx 與 .csv。');}
function formatAmount(value){return new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(Math.round((value+Number.EPSILON)*100)/100);}
async function parseRawFile(file){if(file.name.split('.').pop()?.toLowerCase()!=='xlsx')throw new Error('季職達原始檔僅支援 .xlsx。');const XLSX=await xlsx(),book=XLSX.read(await file.arrayBuffer(),{type:'array'}),sheetName=book.SheetNames[0];if(!sheetName)throw new Error('Excel 檔沒有工作表。');const sheet=book.Sheets[sheetName],rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true}),sourceDate=String(sheet.A3?.v??'').trim();if(!sourceDate)throw new Error('找不到 A3 的資料日期。');const byName=new Map(people.map(p=>[normalizeName(p.name),p])),records=[];for(const row of rows.slice(10)){const p=byName.get(normalizeName(row[5]));if(!p)continue;const target=num(row[9])*3,progress=num(row[59])+num(row[39])+num(row[40]),monthly=num(row[41]),insurance=num(row[40])+num(row[56]),current=performance[key(p.branch,p.name)]||{};records.push({branch:p.branch,advisor_name:p.name,quarter_target:formatAmount(target),quarter_progress:formatAmount(progress),monthly_progress:formatAmount(monthly),quarter_rate:target>0?`${(progress/target*100).toFixed(2)}%`:'—',fund_progress:current.fundProgress||'',insurance_progress:formatAmount(insurance/10000),source_date:sourceDate});}const found=new Set(records.map(r=>r.advisor_name)),missing=people.filter(p=>!found.has(p.name));if(missing.length)throw new Error(`原始檔自第 11 列起缺少 ${missing.length} 位：${missing.map(p=>p.name).join('、')}`);return{sourceDate,records};}
async function upsert(records,message){if(!records.length)throw new Error('找不到可上傳的資料。');setUpload(message);const{error}=await supabase.from('performance_records').upsert(records,{onConflict:'branch,advisor_name'});if(error&&String(error.message||'').includes('monthly_progress'))throw new Error('尚未建立 AP 月進度欄位，請先執行 supabase/monthly-progress.sql。');if(error)throw error;}
async function uploadRaw(file){if(!canWrite||busy)return;setBusy(true);try{setUpload('正在讀取季職達原始檔…');const{sourceDate,records}=await parseRawFile(file);await upsert(records,`正在以 ${sourceDate} 更新 ${records.length} 位選手…`);setBusy(false);await loadPerformance({announce:false});setUpload(`更新成功！${records.length} 位選手已往前衝。`,'success');}catch(error){setUpload(`上傳失敗：${error.message||'請確認檔案格式。'}`,'error');}finally{$('raw-file').value='';setBusy(false);}}
async function updateMonthlyProgress(records,sourceDate){for(const[index,record]of records.entries()){setUpload(`正在更新 AP 月進度 ${index+1}／${records.length}…`);const{data,error}=await supabase.from('performance_records').update({monthly_progress:record.monthly_progress}).eq('branch',record.branch).eq('advisor_name',record.advisor_name).select('advisor_name').maybeSingle();if(error)throw error;if(!data)throw new Error(`找不到 ${record.branch} ${record.advisor_name} 的既有戰況。`);}setUpload(`AP 月進度已更新 ${records.length} 位；來源 ${sourceDate}。季進度、目標、達成率與資料日期均未變更。`,'success');}
async function uploadMonthlyProgress(file){if(!canWrite||busy)return;setBusy(true);try{setUpload('正在讀取 AP 月進度原始檔…');const{sourceDate,records}=await parseRawFile(file);await updateMonthlyProgress(records,sourceDate);setBusy(false);await loadPerformance({announce:false});}catch(error){setUpload(`AP 月進度更新失敗：${error.message||'請確認檔案格式。'}`,'error');}finally{$('monthly-file').value='';setBusy(false);}}
async function uploadPerformance(file){if(!canWrite||busy)return;setBusy(true);try{setUpload('正在檢查 Excel／CSV…');const records=await parsePerformanceFile(file),permitted=new Set(people.map(p=>key(p.branch,p.name))),invalid=records.filter(r=>!permitted.has(key(r.branch,r.advisor_name)));if(invalid.length)throw new Error(`有 ${invalid.length} 筆不在固定名單內。`);const next=records.map(r=>({...r,source_date:performance[key(r.branch,r.advisor_name)]?.sourceDate||''}));await upsert(next,`正在寫入 ${next.length} 筆戰況…`);setBusy(false);await loadPerformance({announce:false});setUpload(`更新成功！已寫入 ${next.length} 筆戰況。`,'success');}catch(error){setUpload(`上傳失敗：${error.message||'請確認檔案格式。'}`,'error');}finally{$('performance-file').value='';setBusy(false);}}
async function signIn(email,password,node){
  if(loginBusy)return;
  if(!email||!password){node.textContent='請輸入帳號與密碼。';return;}
  if(!supabase){node.textContent='雲端尚未連線，請確認網路後重新整理再登入。';return;}
  loginBusy=true;clearTimeout(authSessionTimer);
  const buttons=document.querySelectorAll('#login-dialog button[type="submit"]');
  buttons.forEach(button=>{button.disabled=true;});node.textContent='裁判驗證中…';
  try{
    const{data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error)throw error;
    if(!data?.session)throw new Error('未取得登入狀態，請再試一次。');
    const authorized=await applySession(data.session);
    if(!authorized){node.textContent='登入完成，但尚未取得上傳權限，請使用有權限的管理帳號。';return;}
    node.textContent='';$('manager-password').value='';$('password').value='';
    $('login-dialog').close();if(!$('manage-dialog').open)$('manage-dialog').showModal();
  }catch(error){node.textContent=`登入失敗：${error.message||'請稍後再試。'}`;}
  finally{loginBusy=false;buttons.forEach(button=>{button.disabled=false;});}
}

function setupEvents(){
  document.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}));
  $('raceboard').addEventListener('click',event=>{const button=event.target.closest('[data-cheer-team]');if(button)void submitCheer(button.dataset.cheerTeam);});
  $('login-button').addEventListener('click',()=>{$('login-dialog').showModal();requestAnimationFrame(()=>(hasManagerUploadAccount?$('manager-password'):$('email')).focus());});
  $('font-size-button').addEventListener('click',event=>{event.stopPropagation();const menu=$('font-size-menu'),open=menu.hidden;menu.hidden=!open;$('font-size-button').setAttribute('aria-expanded',String(open));});
  document.querySelectorAll('button[data-font-size]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();applyFontSize(button.dataset.fontSize,{persist:true});$('font-size-menu').hidden=true;$('font-size-button').setAttribute('aria-expanded','false');}));
  document.addEventListener('click',event=>{const control=$('font-size-control');if(!control.contains(event.target)){$('font-size-menu').hidden=true;$('font-size-button').setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){$('font-size-menu').hidden=true;$('font-size-button').setAttribute('aria-expanded','false');}});
  $('manage-button').addEventListener('click',()=>{if(canWrite)$('manage-dialog').showModal();else{$('login-dialog').showModal();requestAnimationFrame(()=>(hasManagerUploadAccount?$('manager-password'):$('email')).focus());}});
  $('refresh-button').addEventListener('click',()=>void loadPerformance());
  $('dialog-sync-button').addEventListener('click',()=>void loadPerformance());
  $('raw-file').addEventListener('change',e=>{const[file]=e.target.files;if(file)void uploadRaw(file);});
  $('monthly-file').addEventListener('change',e=>{const[file]=e.target.files;if(file)void uploadMonthlyProgress(file);});
  $('performance-file').addEventListener('change',e=>{const[file]=e.target.files;if(file)void uploadPerformance(file);});
  $('manager-login-form').addEventListener('submit',e=>{e.preventDefault();void signIn(String(config.uploadAccountEmail),$('manager-password').value,$('manager-login-message'));});
  $('account-login-form').addEventListener('submit',e=>{e.preventDefault();void signIn($('email').value.trim(),$('password').value,$('account-login-message'));});
  $('signout-button').addEventListener('click',async()=>{await supabase.auth.signOut();await applySession(null);});
  $('team-tabs').addEventListener('click',e=>{const button=e.target.closest('[data-team-tab]');if(!button)return;selectedTeam=button.dataset.teamTab;document.querySelectorAll('[data-team-tab]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===button)));renderPlayers();});
  document.addEventListener('visibilitychange',()=>{updateRaceMotion();if(!document.hidden){void refreshCheerDay();void loadPerformance({announce:false});}});
}
async function init(){
  cheerRecords=isConfigured?[]:readLocalCheers();render();setupEvents();setupMotion();
  $('manager-login-form').hidden=!hasManagerUploadAccount;$('login-divider').hidden=!hasManagerUploadAccount;
  $('manager-email').value=hasManagerUploadAccount?String(config.uploadAccountEmail):'';setBusy(false);
  setInterval(()=>void refreshCheerDay(),30000);
  setInterval(()=>{if(!document.hidden)void loadPerformance({announce:false});},60000);
  if(!isConfigured){
    cheerMode='local';renderCheerMode();$('login-button').disabled=true;
    setCloud('尚未設定雲端','error');setStatus('請先完成 Supabase 連線設定。','error');return;
  }
  try{
    const{createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
    supabase=createClient(config.url,config.anonKey);
    supabase.auth.onAuthStateChange((_event,session)=>{
      if(loginBusy)return;
      clearTimeout(authSessionTimer);
      authSessionTimer=setTimeout(()=>void applySession(session),0);
    });
    // Public scores and cheers do not need to wait for administrator verification.
    void loadCheers();
    void loadPerformance({announce:false});
    try{
      const{data,error}=await supabase.auth.getSession();
      if(error)throw error;
      await applySession(data?.session);
    }catch(error){
      setCloud('管理驗證暫時無法使用','error');
      $('manager-login-message').textContent='請重新整理後再試管理驗證。';
    }
  }catch(error){
    cheerMode='retry';renderRace();renderCheerMode();$('login-button').disabled=true;
    setCloud('雲端連線失敗','error');setStatus(`無法連接績效系統：${error.message||'請檢查網路。'}`,'error');
  }
}
void init();
