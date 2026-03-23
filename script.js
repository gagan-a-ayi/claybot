// ── Conversation state ────────────────────────────────────────────────
let state = {
  topic: null,
  subtype: null,
  levelIndex: 0,
  awaitingSubtype: false,
  awaitingTopic: false
};

// ── Pattern matcher ───────────────────────────────────────────────────
function detectTopic(input) {
  const t = input.toLowerCase();
  if (/stress|stressed|overwhelmed|too much|burnt out|burnout|pressure/i.test(t)) return 'stress';
  if (/anxi|panic|nervous|worry|worried|fear|afraid|dread/i.test(t)) return 'anxiety';
  if (/sad|depressed|depression|unhappy|miserable|hopeless|down|low|cry|grief|griev|loss|lost|lonely|alone|heartbreak|breakup|broke up/i.test(t)) return 'sadness';
  if (/great|amazing|wonderful|happy|joy|excit|good|fantastic|content|peaceful|grateful|proud|accomplished/i.test(t)) return 'great';
  if (/coping|cope|overwhelm|procrastin|motiv|anger|angry|frustrat|tip|advice|what can i do|help me|strategy/i.test(t)) return 'coping';
  if (/sleep|insomnia|can't sleep|tired|exhausted|fatigue|nightmare|wake up at night|no energy|always tired/i.test(t)) return 'sleep';
  return null;
}

function detectSubtype(input, topic) {
  const t = input.toLowerCase();
  const ds = DATASET[topic];
  if (!ds) return null;
  const keys = Object.keys(ds.subtypes);
  const keyMaps = {
    stress:   { work:'work', academic:'work', study:'work', job:'work', career:'work', relationship:'relationship', partner:'relationship', financial:'financial', money:'financial', debt:'financial', general:'general' },
    anxiety:  { social:'social', people:'social', crowd:'social', performance:'performance', exam:'performance', presentation:'performance', health:'health', illness:'health', sick:'health', general:'general' },
    sadness:  { grief:'grief', loss:'grief', died:'grief', death:'grief', loneli:'loneliness', alone:'loneliness', isolated:'loneliness', heartbreak:'breakup', breakup:'breakup', 'broke up':'breakup', general:'general', low:'general' },
    great:    { energi:'energised', motiv:'energised', peaceful:'peaceful', calm:'peaceful', grateful:'grateful', thankful:'grateful', accomplish:'accomplished', proud:'accomplished', win:'accomplished' },
    coping:   { overwhelm:'overwhelm', procrastin:'procrastination', anger:'anger', angry:'anger', frustrat:'anger', motiv:'motivation' },
    sleep:    { insomnia:'insomnia', 'cant fall asleep':'insomnia', 'fall asleep':'insomnia', waking:'waking', 'wake up':'waking', 'wake during':'waking', 'during the night':'waking', tired:'tiredness', exhausted:'tiredness', fatigue:'tiredness', 'no energy':'tiredness', 'always tired':'tiredness', nightmare:'nightmares', 'bad dream':'nightmares', disturbed:'nightmares', ptsd:'nightmares' }
  };
  const map = keyMaps[topic] || {};
  for (const [kw, sub] of Object.entries(map)) {
    if (t.includes(kw) && keys.includes(sub)) return sub;
  }
  for (const key of keys) {
    if (t.includes(key)) return key;
  }
  return null;
}

// ── Render helpers ─────────────────────────────────────────────────────
const LEVEL_META = {
  basic:        { label:'Basic',               color:'level-basic',        icon:'🌱', order:0 },
  intermediate: { label:'Intermediate',        color:'level-intermediate', icon:'🌿', order:1 },
  advanced:     { label:'Advanced',            color:'level-advanced',     icon:'🔥', order:2 },
  pro:          { label:'Pro',                 color:'level-pro',          icon:'💎', order:3 },
  consult:      { label:'See a Professional',  color:'level-consult',      icon:'🏥', order:4 },
};

function progressHTML(levelIndex, totalLevels) {
  const stages = ['Basic','Intermediate','Advanced','Pro'];
  const display = stages.slice(0, totalLevels);
  let html = '<div class="progress-bar">';
  display.forEach((s, i) => {
    const cls = i < levelIndex ? 'done' : i === levelIndex ? 'active' : '';
    html += `<div class="prog-step ${cls}"><div class="prog-dot"></div>${s}</div>`;
    if (i < display.length - 1) html += '<div class="prog-sep"></div>';
  });
  html += '</div>';
  return html;
}

function levelBadge(lvl) {
  const m = LEVEL_META[lvl] || LEVEL_META.basic;
  return `<div class="level-badge ${m.color}">${m.icon} ${m.label}</div>`;
}

function buildLevelResponse(topic, subtype, levelIndex) {
  const ds = DATASET[topic];
  if (!ds || !ds.subtypes[subtype]) return null;
  const levels = ds.subtypes[subtype].levels;
  if (levelIndex >= levels.length) return null;
  const lvl = levels[levelIndex];
  const totalLevels = levels.length;

  let html = progressHTML(levelIndex, totalLevels);
  html += levelBadge(lvl.level);
  /*html += `<h2>${lvl.icon} ${lvl.title}</h2>`;*/
  html += lvl.text;

  const isLast = levelIndex === totalLevels - 1;
  const qr = lvl.qr || [];

  return { html, isLast, qr, sources: lvl.sources };
}

// ── DOM ────────────────────────────────────────────────────────────────
const msgContainer = document.getElementById('messages');
const userInput    = document.getElementById('userInput');
const sendBtn      = document.getElementById('sendBtn');

function scrollBottom() { msgContainer.scrollTop = msgContainer.scrollHeight; }

function appendUserMsg(text) {
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `<div class="bubble user-bubble">${escapeHtml(text)}</div>`;
  msgContainer.appendChild(row);
  scrollBottom();
}

function showTyping() {
  const row = document.createElement('div');
  row.className = 'msg-row bot'; row.id = 'typing-row';
  row.innerHTML = `<div class="bot-avatar">🧠</div><div class="typing-bubble"><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
  msgContainer.appendChild(row); scrollBottom();
  return row;
}

function removeTyping() { const t = document.getElementById('typing-row'); if (t) t.remove(); }

// ── FIXED: showTypingThen was missing — restored here ─────────────────
function showTypingThen(cb, delay) {
  showTyping();
  setTimeout(() => { removeTyping(); cb(); }, delay || 900 + Math.random() * 500);
}

function appendBotMsg({ html, qr = [], sources = [], showNext = false, nextLabel = '', isConsult = false }) {
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  let inner = `<div class="bot-avatar">🧠</div><div>`;
  inner += `<div class="bubble bot-bubble">${html}</div>`;

  if (qr.length) {
    inner += `<div class="quick-replies">` + qr.map(q => `<span class="qr-chip" data-msg="${q}">${q}</span>`).join('') + `</div>`;
  }
  if (showNext && !isConsult) {
    inner += `<div class="next-level-wrap"><button class="next-level-btn" id="next-level-btn">⬆️ ${nextLabel} — try next level</button></div>`;
  }
  if (sources && sources.length) {
    inner += `<div class="source-chips">` + sources.map(s => `<span class="source-chip"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 17.93V18a1 1 0 00-2 0v1.93A8.001 8.001 0 014.07 13H6a1 1 0 000-2H4.07A8.001 8.001 0 0111 4.07V6a1 1 0 002 0V4.07A8.001 8.001 0 0119.93 11H18a1 1 0 000 2h1.93A8.001 8.001 0 0113 19.93z"/></svg>${s}</span>`).join('') + `</div>`;
  }
  if (!qr.includes("🔄 Restart Chat")) {
    inner += `<div class="end-chat-wrap"><button class="end-chat-btn">🛑 End Chat</button></div>`;
  }

  inner += `</div>`;
  row.innerHTML = inner;
  msgContainer.appendChild(row);
  scrollBottom();

  row.querySelectorAll('.qr-chip').forEach(chip => {
    chip.addEventListener('click', () => sendMessage(chip.dataset.msg));
  });
  const endBtn = row.querySelector('.end-chat-btn');
  if (endBtn) endBtn.addEventListener('click', endConversation);

  const nb = document.getElementById('next-level-btn');
  if (nb) {
    nb.addEventListener('click', () => {
      nb.closest('.next-level-wrap').remove();
      escalateLevel();
    });
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Level escalation ──────────────────────────────────────────────────
async function escalateLevel() {
  const ds = DATASET[state.topic];
  const levels = ds.subtypes[state.subtype].levels;
  state.levelIndex++;

  // Past all levels — show professional consult
  if (state.levelIndex >= levels.length) {
    showTypingThen(() => appendBotMsg({
      html: CONSULT_LEVEL.text,
      sources: CONSULT_LEVEL.sources,
      qr: ["Start over", "I feel better now", "Thank you ClayBot"],
      showNext: false,
      isConsult: true
    }));
    return;
  }

  const result = buildLevelResponse(state.topic, state.subtype, state.levelIndex);
  if (!result) return;

  const hasNextLevel = state.levelIndex + 1 < levels.length;
  const nextLvl = hasNextLevel ? levels[state.levelIndex + 1].level : 'consult';
  const nextMeta = LEVEL_META[nextLvl] || LEVEL_META.consult;

  showTypingThen(() => appendBotMsg({
    html: result.html,
    qr: result.qr,
    sources: result.sources,
    showNext: hasNextLevel,
    nextLabel: hasNextLevel ? `${nextMeta.icon} ${nextMeta.label}` : '',
  }));
}

// ── Main respond logic ─────────────────────────────────────────────────
async function respond(input) {
  const t = input.toLowerCase().trim();

  if (/restart chat|🔄 restart chat/i.test(t)) { restartChat(); return; }

  if (/suicid|hurt myself|self.harm|end my life|die|no reason to live|want to die/i.test(t)) {
    showTypingThen(() => appendBotMsg({
      html: `<h2>Please reach out right now 🆘</h2><p>I'm very concerned about you. <strong>Your life matters.</strong></p><ul><li><strong>India:</strong> iCall <code>9152987821</code> | Vandrevala <code>1860-2662-345</code></li><li><strong>US:</strong> Call or text <code>988</code></li><li><strong>UK:</strong> Samaritans <code>116 123</code></li><li><strong>International:</strong> <code>befrienders.org</code></li></ul><blockquote>Please reach out to one of these now. You don't have to face this alone. 💙</blockquote>`,
      qr: ["I'm safe but struggling", "I need to talk more"],
      sources: ["befrienders.org", "988lifeline.org"]
    })); return;
  }

  if (/start over|reset|new topic|different topic|back to start/i.test(t)) {
    state = { topic: null, subtype: null, levelIndex: 0, awaitingSubtype: false, awaitingTopic: false };
    showTypingThen(() => appendBotMsg({
      html: `<h2>Let's start fresh 🌿</h2><p>What would you like to check in about today?</p>`,
      qr: ["I'm stressed", "I'm anxious", "I'm sad", "I'm feeling great", "I need coping tips", "I can't sleep"]
    })); return;
  }

  if (state.awaitingSubtype && state.topic) {
    const sub = detectSubtype(input, state.topic);
    const ds = DATASET[state.topic];
    if (sub && ds.subtypes[sub]) {
      state.subtype = sub;
      state.levelIndex = 0;
      state.awaitingSubtype = false;
      const result = buildLevelResponse(state.topic, state.subtype, 0);
      const levels = ds.subtypes[state.subtype].levels;
      const nextLvl = levels.length > 1 ? levels[1].level : 'consult';
      const nextMeta = LEVEL_META[nextLvl] || LEVEL_META.consult;
      showTypingThen(() => appendBotMsg({
        html: result.html,
        qr: result.qr || [],
        sources: result.sources,
        showNext: true,
        nextLabel: `${nextMeta.icon} ${nextMeta.label}`,
      }));
      return;
    }
    showTypingThen(() => appendBotMsg({
      html: `<p>Could you pick one of the options below so I can give you the most targeted help? 🙏</p>`,
      qr: ds.subQR
    }));
    return;
  }

  const topic = detectTopic(input);
  if (topic) {
    state.topic = topic;
    state.levelIndex = 0;
    state.awaitingSubtype = true;
    const sub = detectSubtype(input, topic);
    const ds = DATASET[topic];
    if (sub && ds.subtypes[sub]) {
      state.subtype = sub;
      state.awaitingSubtype = false;
      const result = buildLevelResponse(topic, sub, 0);
      const levels = ds.subtypes[sub].levels;
      const nextLvl = levels.length > 1 ? levels[1].level : 'consult';
      const nextMeta = LEVEL_META[nextLvl] || LEVEL_META.consult;
      showTypingThen(() => appendBotMsg({
        html: result.html,
        qr: result.qr || [],
        sources: result.sources,
        showNext: true,
        nextLabel: `${nextMeta.icon} ${nextMeta.label}`,
      }));
    } else {
      const topicLabels = {
        stress: "stressed", anxiety: "anxious", sadness: "sad or low",
        great: "great", coping: "looking for coping strategies", sleep: "having sleep issues"
      };
      showTypingThen(() => appendBotMsg({
        html: `<h2>I hear you 💙</h2><p>It sounds like you're feeling <strong>${topicLabels[topic] || topic}</strong>. To give you the most relevant, personalised support — can you tell me a bit more about what type?</p>`,
        qr: ds.subQR
      }));
    }
    return;
  }

  if (/not helping|need more|something else|different|still struggling|didn't work|doesn't work/i.test(t) && state.topic && state.subtype) {
    escalateLevel(); return;
  }

  if (/feel better|helped|thank|great advice|this worked|i'm okay now|i'm good/i.test(t)) {
    state = { topic: null, subtype: null, levelIndex: 0, awaitingSubtype: false };
    showTypingThen(() => appendBotMsg({
      html: `<p>That genuinely makes me happy to hear! 🌟 You showed up for yourself today — <strong>that matters.</strong></p><p>Remember: <em>checking in with yourself regularly is one of the most powerful things you can do.</em> I'm always here if you need to talk. 💙</p>`,
      qr: ["Check in again", "I have another topic", "Thank you, goodbye!"]
    }));
    return;
  }

  if (/\bhi\b|\bhello\b|\bhey\b|\bgreetings\b|\bstart\b/i.test(t)) {
    showTypingThen(() => appendBotMsg({
      html: `<h2>Welcome to ClayBot 🧠</h2><p>I'm your <strong>Mental Health Check-in Bot</strong> — a safe, judgment-free space. I'll meet you where you are with <em>step-by-step support</em> from basic through to advanced strategies.</p><blockquote>If one level doesn't help enough, we simply go deeper — together. 💙</blockquote><p>How are you feeling today?</p>`,
      qr: ["I'm stressed", "I'm anxious", "I'm sad", "I'm feeling great", "I need coping tips", "I can't sleep"]
    })); return;
  }

  showTypingThen(() => appendBotMsg({
    html: `<p>I'm here for you 💙 Could you share a little more about how you're feeling? I can offer step-by-step support for each of these:</p>`,
    qr: ["I'm stressed", "I'm anxious", "I'm sad", "I'm feeling great", "I need coping tips", "I can't sleep"]
  }));
}

async function sendMessage(text) {
  const msg = (text || userInput.value).trim();
  if (!msg) return;
  userInput.value = '';
  userInput.style.height = 'auto';
  appendUserMsg(msg);
  await respond(msg);
}

sendBtn.addEventListener('click', () => sendMessage());
userInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
userInput.addEventListener('input', () => { userInput.style.height = 'auto'; userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px'; });

window.addEventListener('load', () => {
  appendBotMsg({
    html: `<h2>Hey there! I'm ClayBot 🧠</h2><p>Your personal <strong>Mental Health Check-in Bot</strong>. I don't just give one generic answer — I give you <em>personalised, progressive support</em>:</p><ul><li>🌱 <strong>Basic</strong> — quick, immediate relief</li><li>🌿 <strong>Intermediate</strong> — structured strategies</li><li>🔥 <strong>Advanced</strong> — deeper work</li><li>💎 <strong>Pro</strong> — high-intensity tools</li><li>🏥 <strong>Professional help</strong> — if more support is needed</li></ul><p>How are you feeling today?</p>`,
    qr: ["I'm stressed", "I'm anxious", "I'm sad / feeling low", "I'm feeling great", "I need coping tips", "I can't sleep"]
  });
});

function restartChat() {
  state = { topic: null, subtype: null, levelIndex: 0, awaitingSubtype: false, awaitingTopic: false };
  msgContainer.innerHTML = '';
  userInput.disabled = false;
  sendBtn.disabled = false;
  userInput.value = '';
  userInput.style.height = 'auto';
  appendBotMsg({
    html: `<h2>Hey there! I'm ClayBot 🧠</h2><p>Your <strong>Mental Health Check-in Bot</strong>.</p><p>We're starting fresh. How are you feeling right now?</p>`,
    qr: ["I'm stressed", "I'm anxious", "I'm sad", "I'm feeling great", "I need coping tips", "I can't sleep"]
  });
}

function endConversation() {
  userInput.disabled = true;
  sendBtn.disabled = true;
  document.querySelectorAll('.qr-chip').forEach(el => el.remove());
  document.querySelectorAll('.next-level-btn').forEach(el => el.remove());
  document.querySelectorAll('.end-chat-wrap').forEach(el => el.remove());
  showTypingThen(() => appendBotMsg({
    html: `<h2>🌿 Session Closed</h2><p>You showed up for yourself today. That matters.</p><blockquote>Growth happens quietly. And you're growing.</blockquote>`,
    qr: ["🔄 Restart Chat"]
  }));
}
