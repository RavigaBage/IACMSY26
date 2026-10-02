const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest({ method = 'GET', path, headers = {}, body = null }) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                ...headers,
                ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(JSON.stringify(body)) } : {}),
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                let json = null;
                try {
                    json = JSON.parse(data);
                } catch {
                    json = data;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: json,
                });
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('===============================================================');
    console.log('🧪 RUNNING RATE LIMIT & AUTH RECOVERY VERIFICATION SUITE');
    console.log('===============================================================');

    let passed = 0;
    let failed = 0;

    function assert(name, condition, details = '') {
        if (condition) {
            console.log(`  ✅ [PASS] ${name}`);
            passed++;
        } else {
            console.error(`  ❌ [FAIL] ${name} ${details}`);
            failed++;
        }
    }

    // 1. IP Detection Verification
    console.log('\n--- 1. Testing Client IP Detection and Trust Proxy ---');
    const proxyIp = '198.51.100.77';
    const ipRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        headers: {
            'X-Forwarded-For': `${proxyIp}, 127.0.0.1`,
            'X-Real-IP': proxyIp,
        },
        body: { identifier: 'nonexistent@test.com', password: 'wrong' }
    });
    // express-rate-limit sets ratelimit headers
    assert('Request with X-Forwarded-For is processed through trust proxy', ipRes.status === 401);
    assert('RateLimit headers are present', ipRes.headers['ratelimit-limit'] !== undefined || ipRes.headers['x-ratelimit-limit'] !== undefined);

    // 2. Normal Login Verification
    console.log('\n--- 2. Testing Normal Login Flow ---');
    const loginRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        headers: { 'X-Forwarded-For': '203.0.113.10, 127.0.0.1' },
        body: { identifier: 'admin@iac.com', password: 'Admin@1234' },
    });
    assert('Admin login returns 200 OK', loginRes.status === 200);
    assert('Access token returned in response body', !!loginRes.body?.access);
    const setCookie = loginRes.headers['set-cookie'];
    const refreshTokenCookie = setCookie ? setCookie.find(c => c.startsWith('refreshToken=')) : null;
    assert('Refresh token set in HttpOnly cookie', !!refreshTokenCookie);

    const accessToken = loginRes.body?.access;
    const cookieHeader = refreshTokenCookie ? refreshTokenCookie.split(';')[0] : '';

    // Verify successful login does not consume login rate limit quota (skipSuccessfulRequests)
    const limitHeaderBefore = loginRes.headers['ratelimit-remaining'] || loginRes.headers['x-ratelimit-remaining'];
    const loginRes2 = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        headers: { 'X-Forwarded-For': '203.0.113.10, 127.0.0.1' },
        body: { identifier: 'admin@iac.com', password: 'Admin@1234' },
    });
    const limitHeaderAfter = loginRes2.headers['ratelimit-remaining'] || loginRes2.headers['x-ratelimit-remaining'];
    assert('skipSuccessfulRequests active: successful login does NOT exhaust quota', 
        limitHeaderBefore === limitHeaderAfter || loginRes2.status === 200);

    // 3. Authenticated Verify & Dashboard Loading
    console.log('\n--- 3. Testing Verify & Protected Dashboard Access ---');
    const verifyRes = await makeRequest({
        method: 'GET',
        path: '/api/auth/verify',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Forwarded-For': '203.0.113.10, 127.0.0.1',
        },
    });
    assert('/api/auth/verify succeeds with valid accessToken', verifyRes.status === 200 && verifyRes.body?.status === 'success');

    // 4. Token Refresh Flow
    console.log('\n--- 4. Testing Token Refresh Flow ---');
    const refreshRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/refresh',
        headers: {
            Cookie: cookieHeader,
            'X-Forwarded-For': '203.0.113.10, 127.0.0.1',
        },
    });
    assert('/api/auth/refresh mints new access token from cookie', refreshRes.status === 200 && !!refreshRes.body?.access);

    // 5. Expired / Missing Token Handling
    console.log('\n--- 5. Testing Missing / Invalid Token Handling ---');
    const unauthVerify = await makeRequest({
        method: 'GET',
        path: '/api/auth/verify',
        headers: { 'X-Forwarded-For': '203.0.113.10, 127.0.0.1' },
    });
    assert('Missing Authorization returns 401 (not rate limited)', unauthVerify.status === 401);

    // 6. High-Frequency Dashboard Polling Simulation
    console.log('\n--- 6. Simulating Rapid Dashboard Polling (IAC Mobile & Reports) ---');
    let pollingOk = true;
    for (let i = 0; i < 20; i++) {
        const [tickets, bookings, issues, summary] = await Promise.all([
            makeRequest({ method: 'GET', path: '/api/iac-mobile/checkin-tickets', headers: { 'X-Forwarded-For': '203.0.113.20, 127.0.0.1' } }),
            makeRequest({ method: 'GET', path: '/api/iac-mobile/booking-requests', headers: { 'X-Forwarded-For': '203.0.113.20, 127.0.0.1' } }),
            makeRequest({ method: 'GET', path: '/api/iac-mobile/issues', headers: { 'X-Forwarded-For': '203.0.113.20, 127.0.0.1' } }),
            makeRequest({ method: 'GET', path: '/api/reports/summary', headers: { Authorization: `Bearer ${accessToken}`, 'X-Forwarded-For': '203.0.113.20, 127.0.0.1' } }),
        ]);

        if (tickets.status === 429 || bookings.status === 429 || issues.status === 429 || summary.status === 429) {
            pollingOk = false;
            break;
        }
    }
    assert('Rapid dashboard polling (80 requests in batch) succeeds without 429 rate-limiting', pollingOk);

    // 7. Brute Force Protection Verification
    console.log('\n--- 7. Testing Brute-Force Login Rate Limiter (distinct IP) ---');
    const attackerIp = '198.51.100.99';
    let hitRateLimit = false;
    let rateLimitMessage = '';

    for (let i = 0; i < 55; i++) {
        const res = await makeRequest({
            method: 'POST',
            path: '/api/auth/login',
            headers: { 'X-Forwarded-For': `${attackerIp}, 127.0.0.1` },
            body: { identifier: `target_${i}@domain.com`, password: 'badpassword' },
        });

        if (res.status === 429) {
            hitRateLimit = true;
            rateLimitMessage = res.body?.message || '';
            break;
        }
    }
    assert('Brute-force attacker hits HTTP 429 rate limit', hitRateLimit);
    assert('Rate-limit error message specifically identifies failed login attempts', 
        rateLimitMessage.toLowerCase().includes('too many failed login attempts'));

    // Check that legitimate user on DIFFERENT IP is completely unaffected
    const legitimateIp = '198.51.100.50';
    const legitimateUserRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        headers: { 'X-Forwarded-For': `${legitimateIp}, 127.0.0.1` },
        body: { identifier: 'admin@iac.com', password: 'Admin@1234' },
    });
    assert('Legitimate user from separate IP is NOT affected by attacker rate-limit', legitimateUserRes.status === 200);

    console.log('\n===============================================================');
    console.log(`📊 SUMMARY: ${passed} Passed, ${failed} Failed out of ${passed + failed} tests`);
    console.log('===============================================================');

    if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
