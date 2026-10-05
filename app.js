const app = document.querySelector('#app');
const side = document.querySelector('#side');
const toast = document.querySelector('#toast');
const menuButton = document.querySelector('#menu');

const DEMO_USERS_KEY = 'emms_demo_users';
const DEMO_SESSION_KEY = 'emms_demo_session';
const DEMO_DB_KEY = 'emms_demo_db';

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

let token = localStorage.getItem(DEMO_SESSION_KEY);
let user = null;
let staticMode = false;

const demoSeed = () => ({
  users: [
    { id: 'u_demo', name: 'Demo User', email: 'user@emmsbet.test', phone: '0712345678', password: 'password123', role: 'user', balance: 2500, kycStatus: 'pending', bettingLimit: 500, selfExcluded: false },
    { id: 'a_demo', name: 'EMMS Admin', email: 'admin@emmsbet.test', phone: '0785815485', password: 'admin123', role: 'admin', balance: 0, kycStatus: 'verified', bettingLimit: 0, selfExcluded: false }
  ],
  transactions: [],
  bets: [],
  kyc: []
});

function readDb() {
  try {
    const raw = localStorage.getItem(DEMO_DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  const db = demoSeed();
  localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db));
  return db;
}

function writeDb(db) {
  localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db));
}

function makeId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}

function getDemoUser() {
  if (!token) return null;
  const db = readDb();
  return db.users.find(u => u.id === token) || null;
}

function note(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function shell(title, body) {
  return `<div class="page-title"><span class="badge">EMMS BET</span><h2>${title}</h2></div>${body}`;
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;

  // GitHub Pages and other static hosts cannot run the Express API from this ZIP.
  // Try the real API first, then transparently fall back to the local demo engine.
  if (!staticMode && location.protocol !== 'file:') {
    try {
      const response = await fetch(path, { ...options, headers });
      const type = response.headers.get('content-type') || '';
      const data = type.includes('application/json') ? await response.json() : null;
      if (response.ok && data) return data;
      if (response.status !== 404 && response.status !== 405) {
        throw Error(data?.error || 'Request failed');
      }
      staticMode = true;
    } catch (err) {
      staticMode = true;
    }
  } else {
    staticMode = true;
  }

  return demoApi(path, options);
}

async function demoApi(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};
  const db = readDb();

  if (path === '/api/health') return { ok: true, mode: 'static-sandbox' };

  if (path === '/api/auth/login' && method === 'POST') {
    const email = String(body.email || '').toLowerCase();
    const password = String(body.password || '');
    const found = db.users.find(u => u.email.toLowerCase() === email && u.password === password);
    if (!found) throw Error('Invalid credentials. Try user@emmsbet.test / password123');
    token = found.id;
    localStorage.setItem(DEMO_SESSION_KEY, token);
    user = { ...found };
    return { token, user: { ...found } };
  }

  if (path === '/api/auth/register' && method === 'POST') {
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');
    if (!name || !email || !phone || password.length < 8) {
      throw Error('Complete all fields; password must be 8+ characters.');
    }
    if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw Error('Email already registered.');
    }
    const created = {
      id: makeId('u'), name, email, phone, password, role: 'user', balance: 0,
      kycStatus: 'not_submitted', bettingLimit: 500, selfExcluded: false
    };
    db.users.push(created);
    writeDb(db);
    token = created.id;
    localStorage.setItem(DEMO_SESSION_KEY, token);
    user = { ...created };
    return { token, user: { ...created } };
  }

  if (path === '/api/me') {
    const found = db.users.find(u => u.id === token);
    if (!found) throw Error('Authentication required');
    user = { ...found };
    return { user: { ...found } };
  }

  if (path === '/api/wallet') {
    const found = db.users.find(u => u.id === token);
    if (!found) throw Error('Authentication required');
    return {
      balance: found.balance,
      transactions: db.transactions.filter(x => x.userId === found.id).slice(-30).reverse()
    };
  }

  if (path.startsWith('/api/payments/')) {
    const found = db.users.find(u => u.id === token);
    if (!found) throw Error('Authentication required');
    const type = path.endsWith('/deposit') ? 'deposit' : 'withdrawal';
    const amount = Number(body.amount);
    if (!['mpesa', 'airtel'].includes(body.provider) || !Number.isFinite(amount) || amount < 10) {
      throw Error('Invalid sandbox payment. Minimum is KES 10.');
    }
    if (type === 'withdrawal' && amount > found.balance) {
      throw Error('Insufficient demo balance.');
    }
    const tx = {
      id: makeId('tx'), userId: found.id, type, provider: body.provider,
      amount, phone: body.phone, status: type === 'deposit' ? 'pending' : 'pending_review',
      reference: 'SANDBOX-' + Date.now(), createdAt: new Date().toISOString()
    };
    db.transactions.push(tx);
    writeDb(db);
    return { message: type === 'deposit'
      ? 'Sandbox deposit created. No real money moved.'
      : 'Sandbox withdrawal queued for review. No real money moved.', transaction: tx };
  }

  if (path === '/api/bets' && method === 'POST') {
    const found = db.users.find(u => u.id === token);
    if (!found) throw Error('Authentication required');
    const odds = Number(body.odds);
    const stake = Number(body.stake);
    if (found.selfExcluded) throw Error('Self-exclusion is active.');
    if (!body.event || !body.selection || odds <= 1 || stake <= 0 || stake > found.bettingLimit || stake > found.balance) {
      throw Error('Invalid bet, limit exceeded, or insufficient balance.');
    }
    found.balance = Number((found.balance - stake).toFixed(2));
    const bet = {
      id: makeId('bet'), userId: found.id, event: body.event, selection: body.selection,
      odds, stake, potentialWin: Number((stake * odds).toFixed(2)), status: 'open',
      createdAt: new Date().toISOString()
    };
    db.bets.push(bet);
    db.transactions.push({ id: makeId('tx'), userId: found.id, type: 'bet', provider: 'ledger', amount: stake, status: 'completed', reference: bet.id, createdAt: new Date().toISOString() });
    writeDb(db);
    user = { ...found };
    return { bet, balance: found.balance };
  }

  if (path === '/api/kyc' && method === 'POST') {
    const found = db.users.find(u => u.id === token);
    if (!found) throw Error('Authentication required');
    if (!body.fullName || !body.idType || !body.idNumber || !body.dateOfBirth) throw Error('Complete KYC fields.');
    const kyc = {
      id: makeId('kyc'), userId: found.id, fullName: body.fullName, idType: body.idType,
      idLast4: String(body.idNumber).slice(-4), dateOfBirth: body.dateOfBirth,
      status: 'pending_review', createdAt: new Date().toISOString()
    };
    db.kyc.push(kyc);
    found.kycStatus = 'pending';
    writeDb(db);
    user = { ...found };
    return { message: 'KYC submitted in sandbox mode.', kyc };
  }

  if (path === '/api/responsible' && method === 'POST') {
    const found = db.users.find(u => u.id === token);
    if (!found) throw Error('Authentication required');
    if (body.limit !== undefined) found.bettingLimit = Math.max(0, Number(body.limit));
    if (body.selfExcluded !== undefined) found.selfExcluded = !!body.selfExcluded;
    writeDb(db);
    user = { ...found };
    return { user: { ...found } };
  }

  if (path === '/api/admin/summary') {
    const adminUser = db.users.find(u => u.id === token);
    if (!adminUser || adminUser.role !== 'admin') throw Error('Admin access required');
    return { users: db.users, transactions: db.transactions, bets: db.bets, kyc: db.kyc };
  }

  if (path.startsWith('/api/admin/kyc/') && method === 'POST') {
    const adminUser = db.users.find(u => u.id === token);
    if (!adminUser || adminUser.role !== 'admin') throw Error('Admin access required');
    const id = path.split('/').pop();
    const k = db.kyc.find(x => x.id === id);
    if (!k) throw Error('KYC record not found');
    k.status = body.status;
    const target = db.users.find(u => u.id === k.userId);
    if (target) target.kycStatus = body.status;
    writeDb(db);
    return { kyc: k };
  }

  throw Error('Demo route not found');
}

async function boot() {
  user = getDemoUser();
  if (user) {
    const refreshed = await api('/api/me').catch(() => null);
    if (refreshed?.user) user = refreshed.user;
  }
  render('home');
}

function render(view) {
  side.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');

  if (view === 'home') {
    app.innerHTML = `
      <section class="hero">
        <span class="badge">SMART • SIMPLE • RESPONSIBLE</span>
        <h1>Bet smarter.<br><span>Play responsibly.</span></h1>
        <p>Explore sports, view odds, manage your sandbox wallet and test the betting flow from your phone.</p>
        <div class="actions">
          <button class="btn" data-v="sports">Explore Sports</button>
          <button class="btn alt" data-v="${user ? 'wallet' : 'account'}">${user ? 'Open Wallet' : 'Sign in / Sign up'}</button>
        </div>
      </section>
      <div class="section-heading"><h2>Popular markets</h2><span class="muted">Sandbox odds</span></div>
      <div class="grid">
        <div class="card market-card"><h3>⚽ Football</h3><p>Premier League & European fixtures</p><button class="btn alt" data-v="sports">View matches</button></div>
        <div class="card market-card"><h3>🏀 Basketball</h3><p>Pre-match and live-style demo markets</p><button class="btn alt" data-v="sports">View matches</button></div>
        <div class="card market-card"><h3>🎮 Esports</h3><p>Quick demo markets and odds</p><button class="btn alt" data-v="sports">View matches</button></div>
      </div>
      <div class="notice">Sandbox only: M-Pesa and Airtel buttons do not move real money.</div>`;
  } else if (view === 'sports') sports();
  else if (view === 'wallet') wallet();
  else if (view === 'account') account();
  else if (view === 'kyc') kyc();
  else if (view === 'responsible') responsible();
  else if (view === 'admin') admin();
}

function sports() {
  const ev = (name, selection, odds) => `
    <div class="event">
      <div><b>${esc(name)}</b><small class="muted"><br>${esc(selection)} to win</small></div>
      <span class="badge">LIVE</span>
      <button class="odd" onclick="bet('${esc(name)}','${esc(selection)}',${odds})">${odds.toFixed(2)}</button>
    </div>`;
  app.innerHTML = shell('Sports', `
    <div class="sport-filter actions">
      <span class="chip active">All</span><span class="chip">Football</span><span class="chip">Basketball</span><span class="chip">Esports</span>
    </div>
    <div class="grid">
      <div class="card"><h3>⚽ Football</h3>${ev('Arsenal vs Chelsea','Arsenal',1.85)}${ev('Barcelona vs Sevilla','Barcelona',1.72)}${ev('Man City vs Liverpool','Man City',1.90)}</div>
      <div class="card"><h3>🏀 Basketball</h3>${ev('Lakers vs Celtics','Lakers',1.95)}${ev('Bucks vs Heat','Bucks',1.78)}</div>
      <div class="card"><h3>🎮 Esports</h3>${ev('Team Alpha vs Team Nova','Team Alpha',2.05)}</div>
    </div>
    <div class="notice">All events and odds shown here are simulated for testing.</div>`);
}

function login() {
  app.innerHTML = shell('Sign in / Sign up', `
    <div class="grid auth-grid">
      <div class="card form">
        <h3>Sign in</h3>
        <div class="field"><label>Email</label><input id="email" autocomplete="username" value="user@emmsbet.test"></div>
        <div class="field"><label>Password</label><input id="pass" type="password" autocomplete="current-password" value="password123"></div>
        <button class="btn" onclick="signin()">Sign in</button>
        <p class="muted small">Demo user: user@emmsbet.test / password123</p>
      </div>
      <div class="card form">
        <h3>Create account</h3>
        <div class="field"><label>Name</label><input id="rn" autocomplete="name"></div>
        <div class="field"><label>Email</label><input id="re" autocomplete="email"></div>
        <div class="field"><label>Phone</label><input id="rp" autocomplete="tel"></div>
        <div class="field"><label>Password</label><input id="rpass" type="password" autocomplete="new-password"></div>
        <button class="btn alt" onclick="signup()">Sign up</button>
      </div>
    </div>`);
}

async function signin() {
  try {
    const d = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: email.value, password: pass.value }) });
    token = d.token; user = d.user;
    localStorage.setItem(DEMO_SESSION_KEY, token);
    note('Welcome back');
    render('home');
  } catch (e) { note(e.message); }
}

async function signup() {
  try {
    const d = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: rn.value, email: re.value, phone: rp.value, password: rpass.value }) });
    token = d.token; user = d.user;
    localStorage.setItem(DEMO_SESSION_KEY, token);
    note('Account created');
    render('home');
  } catch (e) { note(e.message); }
}

function wallet() {
  if (!user) return login();
  app.innerHTML = shell('Wallet', `
    <div class="wallet-top grid">
      <div class="card balance-card"><div class="muted">Demo balance</div><div class="stat">KES ${Number(user.balance).toFixed(2)}</div><small class="muted">Sandbox balance only</small></div>
      <div class="card"><h3>Deposit</h3><p class="small muted">Test the payment flow without moving money.</p><button class="btn" onclick="pay('deposit','mpesa')">M-Pesa</button> <button class="btn alt" onclick="pay('deposit','airtel')">Airtel</button></div>
      <div class="card"><h3>Withdraw</h3><p class="small muted">Withdrawals are simulated and queued.</p><button class="btn alt" onclick="pay('withdraw','mpesa')">M-Pesa</button> <button class="btn alt" onclick="pay('withdraw','airtel')">Airtel</button></div>
    </div>
    <div class="card" style="margin-top:15px"><h3>Transactions</h3><div id="tx">Loading…</div></div>`);
  loadTx();
}

async function loadTx() {
  try {
    const d = await api('/api/wallet');
    document.querySelector('#tx').innerHTML = d.transactions.length
      ? `<div class="table-wrap"><table class="table"><tr><th>Type</th><th>Provider</th><th>Amount</th><th>Status</th></tr>${d.transactions.map(x => `<tr><td>${esc(x.type)}</td><td>${esc(x.provider)}</td><td>KES ${Number(x.amount).toFixed(2)}</td><td>${esc(x.status)}</td></tr>`).join('')}</table></div>`
      : '<p class="muted">No transactions yet.</p>';
  } catch (e) {
    document.querySelector('#tx').innerHTML = `<p class="muted">${esc(e.message)}</p>`;
  }
}

async function pay(type, provider) {
  const amount = Number(prompt('Amount (KES):'));
  const phone = prompt('Phone number:');
  if (!amount || !phone) return;
  try {
    const d = await api('/api/payments/' + type, { method: 'POST', body: JSON.stringify({ provider, amount, phone }) });
    note(d.message);
    const current = getDemoUser();
    if (current) user = current;
    wallet();
  } catch (e) { note(e.message); }
}

function bet(eventName, selection, odds) {
  if (!user) return login();
  app.innerHTML = shell('Place demo bet', `
    <div class="card form">
      <span class="badge">${odds.toFixed(2)} ODDS</span>
      <h3>${esc(eventName)}</h3>
      <p>${esc(selection)} to win</p>
      <div class="field"><label>Stake (KES)</label><input id="stake" type="number" value="50" min="10"></div>
      <div class="return-box">Potential return: <strong>KES <span id="ret">${(50 * odds).toFixed(2)}</span></strong></div>
      <div class="actions"><button class="btn" onclick="placeBet('${esc(eventName)}','${esc(selection)}',${odds})">Place Bet</button><button class="btn alt" data-v="sports">Back to sports</button></div>
    </div>`);
  document.querySelector('#stake').oninput = () => {
    document.querySelector('#ret').textContent = (Number(document.querySelector('#stake').value) * odds).toFixed(2);
  };
}

async function placeBet(eventName, selection, odds) {
  try {
    const d = await api('/api/bets', { method: 'POST', body: JSON.stringify({ event: eventName, selection, odds, stake: Number(document.querySelector('#stake').value) }) });
    user.balance = d.balance;
    note('Demo bet placed');
    wallet();
  } catch (e) { note(e.message); }
}

function account() {
  if (!user) return login();
  app.innerHTML = shell('My Account', `
    <div class="grid">
      <div class="card"><h3>${esc(user.name)}</h3><p>${esc(user.email)}</p><p>Phone: ${esc(user.phone)}</p><p>KYC: <span class="badge">${esc(user.kycStatus)}</span></p></div>
      <div class="card"><h3>Bet limit</h3><div class="stat">KES ${Number(user.bettingLimit).toFixed(2)}</div></div>
      <div class="card"><h3>Session</h3><p class="muted">${staticMode ? 'Static sandbox' : 'API mode'}</p><button class="btn danger" onclick="logout()">Log out</button></div>
    </div>`);
}

function kyc() {
  if (!user) return login();
  app.innerHTML = shell('KYC Verification', `
    <div class="notice">Production KYC should use a compliant identity-verification process and secure document storage.</div>
    <div class="card form">
      <div class="field"><label>Full name</label><input id="kn" value="${esc(user.name)}"></div>
      <div class="field"><label>ID type</label><select id="ki"><option>National ID</option><option>Passport</option></select></div>
      <div class="field"><label>ID number</label><input id="kid"></div>
      <div class="field"><label>Date of birth</label><input id="kd" type="date"></div>
      <button class="btn" onclick="submitKyc()">Submit KYC</button>
    </div>`);
}

async function submitKyc() {
  try {
    const d = await api('/api/kyc', { method: 'POST', body: JSON.stringify({ fullName: kn.value, idType: ki.value, idNumber: kid.value, dateOfBirth: kd.value }) });
    user.kycStatus = 'pending';
    note(d.message);
    kyc();
  } catch (e) { note(e.message); }
}

function responsible() {
  if (!user) return login();
  app.innerHTML = shell('Responsible Gambling', `
    <div class="card">
      <h3>Betting limit</h3>
      <p class="muted">Set the maximum stake for each demo bet.</p>
      <div class="field"><input id="lim" type="number" min="0" value="${Number(user.bettingLimit)}"></div>
      <button class="btn" onclick="saveRG()">Save limit</button>
    </div>
    <div class="card" style="margin-top:15px">
      <h3>Self-exclusion</h3><p>Self-exclusion blocks new demo bets.</p>
      <button class="btn danger" onclick="rg(true)">Self-exclude</button> <button class="btn alt" onclick="rg(false)">Remove</button>
    </div>`);
}

async function saveRG() { await rg(user.selfExcluded, Number(document.querySelector('#lim').value)); }

async function rg(excluded, limit) {
  try {
    const d = await api('/api/responsible', { method: 'POST', body: JSON.stringify({ selfExcluded: excluded, limit }) });
    user = d.user;
    note('Settings updated');
    responsible();
  } catch (e) { note(e.message); }
}

async function admin() {
  if (!user) return login();
  if (user.role !== 'admin') { note('Admin access required'); return; }
  app.innerHTML = shell('Admin Operations', `
    <div class="grid"><div class="card"><div class="muted">Users</div><div class="stat" id="uc">—</div></div><div class="card"><div class="muted">KYC</div><div class="stat" id="kc">—</div></div><div class="card"><div class="muted">Transactions</div><div class="stat" id="tc">—</div></div></div>
    <div class="card" style="margin-top:15px"><h3>KYC queue</h3><div id="aq">Loading…</div></div>`);
  try {
    const d = await api('/api/admin/summary');
    document.querySelector('#uc').textContent = d.users.length;
    document.querySelector('#kc').textContent = d.kyc.length;
    document.querySelector('#tc').textContent = d.transactions.length;
    document.querySelector('#aq').innerHTML = d.kyc.length
      ? d.kyc.map(k => `<p>${esc(k.fullName)} · ••••${esc(k.idLast4)} · ${esc(k.status)} <button class="btn" onclick="review('${esc(k.id)}','verified')">Verify</button> <button class="btn danger" onclick="review('${esc(k.id)}','rejected')">Reject</button></p>`).join('')
      : '<p class="muted">No KYC submissions.</p>';
  } catch (e) {
    document.querySelector('#aq').innerHTML = `<p class="muted">${esc(e.message)}</p>`;
  }
}

async function review(id, status) {
  try {
    await api('/api/admin/kyc/' + encodeURIComponent(id), { method: 'POST', body: JSON.stringify({ status }) });
    note('KYC updated');
    admin();
  } catch (e) { note(e.message); }
}

function logout(show = true) {
  token = null;
  user = null;
  localStorage.removeItem(DEMO_SESSION_KEY);
  if (show) note('Logged out');
  render('home');
}

document.addEventListener('click', (event) => {
  const view = event.target?.dataset?.v;
  if (view) {
    if (view === 'account' && !user) return login();
    render(view);
  }
});

menuButton.addEventListener('click', () => {
  const open = side.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

document.querySelector('#logout').addEventListener('click', () => logout());

window.signin = signin;
window.signup = signup;
window.wallet = wallet;
window.pay = pay;
window.bet = bet;
window.placeBet = placeBet;
window.submitKyc = submitKyc;
window.saveRG = saveRG;
window.rg = rg;
window.admin = admin;
window.review = review;
window.logout = logout;
window.render = render;

boot();
