const http = require('http');

const BASE_URL = 'http://localhost:8080';

function post(path, body, token, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(resData) });
          } catch {
            resolve({ status: res.statusCode, body: resData });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(resData) });
          } catch {
            resolve({ status: res.statusCode, body: resData });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function del(path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(resData) });
          } catch {
            resolve({ status: res.statusCode, body: resData });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('🚀 Running Live PostgreSQL Concurrency & Integration Tests...');

  // 1. Login as emp1 and emp2
  const login1 = await post('/auth/login', { email: 'emp1@syscolabs.com', password: 'password' });
  const token1 = login1.body.tokens.accessToken;

  const login2 = await post('/auth/login', { email: 'emp2@syscolabs.com', password: 'password' });
  const token2 = login2.body.tokens.accessToken;

  console.log('✅ Logged in emp1 and emp2');

  // Check available trips
  const tripsRes = await get('/trips', token1);
  const trip = tripsRes.body.trips[0];
  const tripId = trip.id;
  console.log(`✅ Using Trip ID ${tripId} (${trip.routeName})`);

  // 2. Concurrency Test: Two employees attempt to hold the SAME seat at the exact same moment
  console.log('⚡ Concurrency Test: Simultaneous seat hold contention on seat 31...');
  const [hold1, hold2] = await Promise.all([
    post(`/trips/${tripId}/holds`, { partySize: 1, seatIds: [31] }, token1),
    post(`/trips/${tripId}/holds`, { partySize: 1, seatIds: [31] }, token2),
  ]);

  const holdSuccessCount = [hold1, hold2].filter((r) => r.status === 201).length;
  const holdConflictCount = [hold1, hold2].filter((r) => r.status === 409).length;

  if (holdSuccessCount === 1 && holdConflictCount === 1) {
    console.log('✅ SUCCESS: Exactly 1 employee secured the seat hold, the other was rejected with 409 conflict!');
  } else {
    throw new Error(`Concurrency hold failed: success=${holdSuccessCount}, conflict=${holdConflictCount}`);
  }

  // Identify who got the hold
  const winner = hold1.status === 201 ? { token: token1, hold: hold1.body.hold } : { token: token2, hold: hold2.body.hold };
  const loserToken = hold1.status === 201 ? token2 : token1;

  console.log(`✅ Winner Hold ID: ${winner.hold.id}, Expires in: ${winner.hold.expiresInSeconds}s`);

  // 3. Confirm Hold into confirmed booking
  console.log('⚡ Confirming seat hold into confirmed booking...');
  const confirmRes = await post(`/trips/${tripId}/holds/${winner.hold.id}/confirm`, {}, winner.token);
  if (confirmRes.status !== 200) {
    throw new Error(`Failed to confirm hold: ${JSON.stringify(confirmRes.body)}`);
  }
  const confirmedBookingId = confirmRes.body.booking.id;
  console.log(`✅ Hold successfully confirmed into Booking ID ${confirmedBookingId}!`);

  // 4. Idempotency Test: Confirm replay
  console.log('⚡ Idempotency Test: Repeating confirmation on already-confirmed hold...');
  const replayRes = await post(`/trips/${tripId}/holds/${winner.hold.id}/confirm`, {}, winner.token);
  if (replayRes.status === 200 && replayRes.body.booking.id === confirmedBookingId) {
    console.log('✅ SUCCESS: Repeated confirmation safely returned existing booking without duplicating!');
  } else {
    throw new Error(`Idempotency confirm failed: ${JSON.stringify(replayRes.body)}`);
  }

  // 5. Loser joins waitlist
  console.log('⚡ Waitlist Test: Loser joins waitlist for the trip...');
  const waitlistRes = await post(`/trips/${tripId}/waitlist`, { partySize: 1 }, loserToken);
  if (waitlistRes.status !== 201 || waitlistRes.body.waitlist.status !== 'waiting') {
    throw new Error(`Waitlist join failed: ${JSON.stringify(waitlistRes.body)}`);
  }
  const waitlistId = waitlistRes.body.waitlist.id;
  console.log(`✅ Joined waitlist! Entry ID: ${waitlistId}, Position: ${waitlistRes.body.waitlist.position}`);

  // 6. Automatic Waitlist Promotion Test: Winner cancels booking -> Loser promoted
  console.log('⚡ Automatic Promotion Test: Cancelling booking to trigger waitlist promotion...');
  const cancelRes = await del(`/bookings/${confirmedBookingId}`, winner.token);
  if (cancelRes.status !== 200 || cancelRes.body.promotedCount !== 1) {
    throw new Error(`Cancellation / promotion failed: ${JSON.stringify(cancelRes.body)}`);
  }
  console.log(`✅ Booking cancelled! Waitlist promotion triggered: promotedCount = ${cancelRes.body.promotedCount}`);
  console.log(`✅ Promoted Entry: ${JSON.stringify(cancelRes.body.promotions[0])}`);

  // 7. Verify promoted user's booking
  const promotedBookingId = cancelRes.body.promotions[0].bookingId;
  const myBookingsRes = await get('/bookings/me', loserToken);
  const foundBooking = myBookingsRes.body.bookings.find((b) => b.id === promotedBookingId);
  if (foundBooking && foundBooking.status === 'confirmed') {
    console.log(`✅ SUCCESS: Promoted employee now has confirmed booking #${foundBooking.id} with assigned seats!`);
  } else {
    throw new Error(`Promoted booking not found in loser bookings: ${JSON.stringify(myBookingsRes.body)}`);
  }

  // Cleanup: Cancel promoted booking
  await del(`/bookings/${promotedBookingId}`, loserToken);
  console.log('✅ Cleanup completed.');

  console.log('\n🎉 ALL LIVE CONCURRENCY & INTEGRATION TESTS PASSED 100%!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

