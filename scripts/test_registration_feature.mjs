/**
 * Comprehensive Automated Verification Suite for Employee Registration Feature
 * Tests all requirements against the real running API Gateway, Auth Service, and PostgreSQL
 */
import { execSync } from 'child_process';

const GATEWAY_URL = 'http://localhost:8080';
const AUTH_URL = 'http://localhost:3001';
const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/corporate_shuttle';

const testSummary = [];

function record(name, passed, details = '') {
  testSummary.push({ name, passed, details });
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${name} ${details ? `(${details})` : ''}`);
}

async function request(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('===============================================================');
  console.log('   EcoCommute — Employee Registration Feature Verification');
  console.log('===============================================================\n');

  // 1. Gateway Health
  try {
    const res = await request(`${GATEWAY_URL}/health`);
    record(
      'Gateway Health check (/health)',
      res.status === 200 && res.data.status === 'ok',
      `Status: ${res.status}, Routes: ${Object.keys(res.data.routes || {}).join(', ')}`
    );
  } catch (err) {
    record('Gateway Health check (/health)', false, err.message);
  }

  // 2. Auth Service Health directly
  try {
    const res = await request(`${AUTH_URL}/health`);
    record(
      'Auth Service Health check (/health)',
      res.status === 200 && res.data.status === 'ok',
      `Status: ${res.status}, DB: ${res.data.database}`
    );
  } catch (err) {
    record('Auth Service Health check (/health)', false, err.message);
  }

  // 3. Auth Service Health through Gateway
  try {
    const res = await request(`${GATEWAY_URL}/auth/health`);
    record(
      'Auth Health through Gateway (/auth/health)',
      res.status === 200 && res.data.status === 'ok',
      `Status: ${res.status}, DB: ${res.data.database}`
    );
  } catch (err) {
    record('Auth Health through Gateway (/auth/health)', false, err.message);
  }

  // 4. Missing Required Fields
  try {
    const res = await request(`${GATEWAY_URL}/auth/register`, 'POST', {});
    const hasFieldErrors = res.status === 400 && res.data.error?.code === 'VALIDATION_ERROR' && res.data.error?.details?.email;
    record(
      'Validation Error: Missing required fields',
      hasFieldErrors,
      `Status: ${res.status}, Error: ${res.data.error?.code}`
    );
  } catch (err) {
    record('Validation Error: Missing required fields', false, err.message);
  }

  // 5. Invalid Email Format
  try {
    const res = await request(`${GATEWAY_URL}/auth/register`, 'POST', {
      email: 'not-an-email',
      password: 'StrongPassword2026!',
      fullName: 'Test User',
      companyId: 1,
    });
    record(
      'Validation Error: Invalid email format',
      res.status === 400 && res.data.error?.details?.email,
      `Status: ${res.status}, Details: ${JSON.stringify(res.data.error?.details?.email)}`
    );
  } catch (err) {
    record('Validation Error: Invalid email format', false, err.message);
  }

  // 6. Password Shorter than 8 Characters
  try {
    const res = await request(`${GATEWAY_URL}/auth/register`, 'POST', {
      email: 'shortpass@syscolabs.com',
      password: 'short',
      fullName: 'Test User',
      companyId: 1,
    });
    record(
      'Validation Error: Password shorter than 8 characters',
      res.status === 400 && res.data.error?.details?.password,
      `Status: ${res.status}, Details: ${JSON.stringify(res.data.error?.details?.password)}`
    );
  } catch (err) {
    record('Validation Error: Password shorter than 8 characters', false, err.message);
  }

  // 7. Invalid Role Rejection
  try {
    const res = await request(`${GATEWAY_URL}/auth/register`, 'POST', {
      email: 'badrole@syscolabs.com',
      password: 'StrongPassword2026!',
      fullName: 'Test User',
      role: 'superadmin_hacker',
    });
    record(
      'Validation Error: Invalid role rejected',
      res.status === 400 && res.data.error?.code === 'VALIDATION_ERROR',
      `Status: ${res.status}, Details: ${JSON.stringify(res.data.error?.details?.role)}`
    );
  } catch (err) {
    record('Validation Error: Invalid role rejected', false, err.message);
  }

  // 8. Invalid Company ID
  try {
    const res = await request(`${GATEWAY_URL}/auth/register`, 'POST', {
      email: 'badcompany@syscolabs.com',
      password: 'StrongPassword2026!',
      fullName: 'Test User',
      companyId: 9999,
    });
    record(
      'Company Validation: Non-existent companyId rejected',
      res.status === 400 && res.data.error?.code === 'INVALID_COMPANY',
      `Status: ${res.status}, Message: ${res.data.error?.message}`
    );
  } catch (err) {
    record('Company Validation: Non-existent companyId rejected', false, err.message);
  }

  // 9. Successful Employee Registration Through Gateway
  const uniqueEmail = `sarah.employee.${Date.now()}@syscolabs.com`;
  const plainPassword = 'CorporatePass2026!';
  let registeredUserId = null;
  let receivedTokens = null;

  try {
    const res = await request(`${GATEWAY_URL}/auth/register`, 'POST', {
      email: uniqueEmail,
      password: plainPassword,
      fullName: 'Sarah Employee',
      role: 'employee',
      companyId: 1,
      workCode: 'SL-99120',
    });
    const is201 = res.status === 201;
    const hasUser = res.data.user && res.data.user.email === uniqueEmail && res.data.user.role === 'employee';
    const hasTokens = res.data.tokens?.accessToken && res.data.tokens?.refreshToken;
    registeredUserId = res.data.user?.id;
    receivedTokens = res.data.tokens;

    record(
      'Successful Registration (201 Created via Gateway)',
      is201 && hasUser && hasTokens,
      `User ID: ${registeredUserId}, Role: ${res.data.user?.role}, Token Type: ${res.data.tokens?.tokenType}`
    );
  } catch (err) {
    record('Successful Registration (201 Created via Gateway)', false, err.message);
  }

  // 10. Duplicate Email Registration (409 Conflict)
  try {
    const res = await request(`${GATEWAY_URL}/auth/register`, 'POST', {
      email: uniqueEmail,
      password: plainPassword,
      fullName: 'Sarah Duplicate',
      companyId: 1,
    });
    record(
      'Duplicate Email Rejection (409 USER_EXISTS)',
      res.status === 409 && res.data.error?.code === 'USER_EXISTS',
      `Status: ${res.status}, Error Code: ${res.data.error?.code}`
    );
  } catch (err) {
    record('Duplicate Email Rejection (409 USER_EXISTS)', false, err.message);
  }

  // 11. Database Persistence in PostgreSQL
  try {
    const userJson = execSync(
      `docker exec shuttle_postgis psql -U postgres -d corporate_shuttle -t -c "SELECT row_to_json(u) FROM (SELECT id, email, role, company_id FROM core.users WHERE id = ${registeredUserId}) u;"`,
      { encoding: 'utf-8' }
    ).trim();
    const userRow = userJson ? JSON.parse(userJson) : null;
    const userPersisted = userRow && userRow.email === uniqueEmail && userRow.role === 'employee';

    const credHash = execSync(
      `docker exec shuttle_postgis psql -U postgres -d corporate_shuttle -t -c "SELECT password_hash FROM auth.credentials WHERE user_id = ${registeredUserId};"`,
      { encoding: 'utf-8' }
    ).trim();
    const credPersisted = credHash && (credHash.startsWith('$2a$') || credHash.startsWith('$2b$'));

    const tokenHash = execSync(
      `docker exec shuttle_postgis psql -U postgres -d corporate_shuttle -t -c "SELECT token_hash FROM auth.refresh_tokens WHERE user_id = ${registeredUserId} AND revoked = false LIMIT 1;"`,
      { encoding: 'utf-8' }
    ).trim();
    const tokenPersisted = Boolean(tokenHash);

    record(
      'Database Persistence: core.users, auth.credentials & auth.refresh_tokens',
      userPersisted && credPersisted && tokenPersisted,
      `Users row: ${userRow ? 'found' : 'missing'}, Credentials: ${credPersisted ? 'found (bcrypt)' : 'missing'}, Refresh Token: ${tokenPersisted ? 'found' : 'missing'}`
    );
  } catch (err) {
    record('Database Persistence: core.users & credentials', false, err.message);
  }

  // 12. Login with Newly Registered Employee Credentials Through Gateway
  try {
    const res = await request(`${GATEWAY_URL}/auth/login`, 'POST', {
      email: uniqueEmail,
      password: plainPassword,
    });
    const is200 = res.status === 200;
    const matchesUser = res.data.user && res.data.user.email === uniqueEmail && res.data.user.role === 'employee';
    const hasTokens = res.data.tokens?.accessToken && res.data.tokens?.refreshToken;

    record(
      'Login with Newly Registered Employee (200 OK via Gateway)',
      is200 && matchesUser && hasTokens,
      `User: ${res.data.user?.fullName}, Email: ${res.data.user?.email}, Role: ${res.data.user?.role}`
    );
  } catch (err) {
    record('Login with Newly Registered Employee (200 OK via Gateway)', false, err.message);
  }

  // 13. Login Failure with Incorrect Password
  try {
    const res = await request(`${GATEWAY_URL}/auth/login`, 'POST', {
      email: uniqueEmail,
      password: 'WrongPassword!',
    });
    record(
      'Login Failure: Incorrect password rejected (401)',
      res.status === 401 && res.data.error?.code === 'INVALID_CREDENTIALS',
      `Status: ${res.status}, Error Code: ${res.data.error?.code}`
    );
  } catch (err) {
    record('Login Failure: Incorrect password rejected (401)', false, err.message);
  }

  // 14. Downstream Booking Service Proxy via Gateway
  try {
    const res = await request(`${GATEWAY_URL}/trips`);
    record(
      'Gateway Proxy: /trips forwarded to Booking Service',
      res.status === 200 && Array.isArray(res.data.trips),
      `Status: ${res.status}, Total Trips: ${res.data.trips?.length}`
    );
  } catch (err) {
    record('Gateway Proxy: /trips forwarded to Booking Service', false, err.message);
  }

  console.log('\n===============================================================');
  const passCount = testSummary.filter((t) => t.passed).length;
  console.log(`Results: ${passCount} / ${testSummary.length} passed.`);
  console.log('===============================================================\n');

  if (passCount !== testSummary.length) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
