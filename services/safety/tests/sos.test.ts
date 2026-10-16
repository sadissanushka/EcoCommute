import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server';
import { config } from '../src/config';
import { pool } from '../src/db/pool';

describe('Step 2.2: SOS Emergency Trigger & Resolution Lifecycle', () => {
  afterAll(async () => {
    await pool.end();
  });

  const employeeToken = jwt.sign(
    { id: 5, email: 'emp1@syscolabs.com', role: 'employee', companyId: 1 },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const adminToken = jwt.sign(
    { id: 1, email: 'admin@syscolabs.com', role: 'admin', companyId: 1 },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  let createdSosId: number;

  it('rejects unauthenticated SOS trigger with 401', async () => {
    const res = await request(app).post('/safety/sos').send({ tripId: 1 });
    expect(res.status).toBe(401);
  });

  it('triggers emergency SOS and records open event', async () => {
    const res = await request(app)
      .post('/safety/sos')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        tripId: 1,
        lat: 6.9042,
        lng: 79.9547,
        note: 'Passenger emergency test',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.event).toBeDefined();
    expect(res.body.event.status).toBe('open');
    expect(res.body.event.userId).toBe(5);

    createdSosId = res.body.event.id;
  });

  it('lists active SOS events for authenticated safety operators', async () => {
    const res = await request(app)
      .get('/safety/sos/active')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
    const item = res.body.events.find((e: any) => e.id === createdSosId);
    expect(item).toBeDefined();
  });

  it('allows safety admin to acknowledge open SOS event', async () => {
    const res = await request(app)
      .post(`/safety/sos/${createdSosId}/ack`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('acknowledged');
    expect(res.body.event.status).toBe('acknowledged');
  });

  it('allows safety admin to resolve SOS event with resolution notes', async () => {
    const res = await request(app)
      .post(`/safety/sos/${createdSosId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Contacted driver Sunil. Flat tire safely repaired and route resumed.' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');
    expect(res.body.event.status).toBe('resolved');
    expect(res.body.event.note).toContain('Flat tire safely repaired');
  });
});
