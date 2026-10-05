const https = require('https');

function requestJson(url, options, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'POST',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data || '{}'); } catch { parsed = { raw: data }; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
        else reject(new Error(`M-Pesa HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function assertProductionConfig() {
  const required = ['MPESA_CONSUMER_KEY','MPESA_CONSUMER_SECRET','MPESA_SHORTCODE','MPESA_PASSKEY','MPESA_CALLBACK_BASE_URL'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Missing M-Pesa production configuration: ${missing.join(', ')}`);
}

async function accessToken() {
  assertProductionConfig();
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const u = new URL('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials');
  return new Promise((resolve, reject) => {
    const req = https.request({hostname:u.hostname,path:u.pathname+u.search,method:'GET',headers:{Authorization:`Basic ${auth}`}}, res => {
      let data=''; res.on('data',c=>data+=c); res.on('end',()=>{
        try { const j=JSON.parse(data); if(res.statusCode>=200&&res.statusCode<300) resolve(j.access_token); else reject(new Error(data)); }
        catch(e){reject(e)}
      });
    }); req.on('error',reject); req.end();
  });
}

function timestamp() {
  const d = new Date();
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function stkPush({phone, amount, accountReference, description}) {
  const token = await accessToken();
  const ts = timestamp();
  const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${ts}`).toString('base64');
  return requestJson('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
    headers: { Authorization: `Bearer ${token}` }
  }, {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: ts,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: phone,
    PartyB: process.env.MPESA_SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: `${process.env.MPESA_CALLBACK_BASE_URL}/api/payments/mpesa/stk-callback`,
    AccountReference: accountReference,
    TransactionDesc: description || 'EMMS BET wallet deposit'
  });
}

module.exports = { stkPush };
