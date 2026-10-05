/*
 * Airtel Money production adapter boundary.
 * Exact production endpoint/payload fields are supplied by the approved
 * Airtel Money merchant onboarding. Keep credentials server-side.
 */
function assertConfig() {
  const required=['AIRTEL_CLIENT_ID','AIRTEL_CLIENT_SECRET','AIRTEL_MERCHANT_CODE','AIRTEL_CALLBACK_BASE_URL'];
  const missing=required.filter(k=>!process.env[k]);
  if(missing.length) throw new Error(`Missing Airtel production configuration: ${missing.join(', ')}`);
}

async function createCollection() {
  assertConfig();
  throw new Error('Airtel production endpoint mapping must be completed from the approved merchant API contract before enabling live collections.');
}

async function createDisbursement() {
  assertConfig();
  throw new Error('Airtel production endpoint mapping must be completed from the approved merchant API contract before enabling live disbursements.');
}

module.exports={createCollection,createDisbursement};
