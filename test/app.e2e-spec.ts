import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';

describe('VSEEDS Backend (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Health ─────────────────────────────────────────────────────

  describe('Health', () => {
    it('GET /api/health should return OK', () => {
      return request(server).get('/api/health').expect(200);
    });
  });

  // ─── Auth Flow ──────────────────────────────────────────────────

  describe('Auth', () => {
    it('POST /api/auth/user-login with invalid credentials should return 401', () => {
      return request(server)
        .post('/api/auth/user-login')
        .send({ email: 'nonexistent@test.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('POST /api/auth/user-login with missing fields should return 400', () => {
      return request(server)
        .post('/api/auth/user-login')
        .send({ email: '' })
        .expect(400);
    });

    it('POST /api/auth/admin-login with invalid credentials should return 401', () => {
      return request(server)
        .post('/api/auth/admin-login')
        .send({ email: 'noadmin@test.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('GET /api/auth/profile without token should return 401', () => {
      return request(server).get('/api/auth/profile').expect(401);
    });
  });

  // ─── Public Products ────────────────────────────────────────────

  describe('Products (public)', () => {
    it('GET /api/products/all should return products', () => {
      return request(server).get('/api/products/all').expect(200);
    });
  });

  // ─── Public Categories ──────────────────────────────────────────

  describe('Categories (public)', () => {
    it('GET /api/categories/all should return categories', () => {
      return request(server).get('/api/categories/all').expect(200);
    });

    it('GET /api/categories/tree should return category tree', () => {
      return request(server).get('/api/categories/tree').expect(200);
    });
  });

  // ─── Public Quotes ──────────────────────────────────────────────

  describe('Quotes (public)', () => {
    it('POST /api/quotes should create a quote', () => {
      return request(server)
        .post('/api/quotes')
        .send({
          serviceType: 'PCB Assembly',
          details: { layers: 2, quantity: 10 },
          customerName: 'Test User',
          customerEmail: 'test@example.com',
          customerPhone: '0771234567',
        })
        .expect(201);
    });

    it('POST /api/quotes with missing fields should return 400', () => {
      return request(server)
        .post('/api/quotes')
        .send({ serviceType: 'PCB' })
        .expect(400);
    });

    it('GET /api/quotes/user/:email should return quotes', () => {
      return request(server)
        .get('/api/quotes/user/test@example.com')
        .expect(200);
    });
  });

  // ─── Public Contact ─────────────────────────────────────────────

  describe('Contact (public)', () => {
    it('POST /api/contact/add should create a contact', () => {
      return request(server)
        .post('/api/contact/add')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          message: 'Testing the contact form',
        })
        .expect(201);
    });

    it('POST /api/contact/add with missing fields should return 400', () => {
      return request(server)
        .post('/api/contact/add')
        .send({ name: '' })
        .expect(400);
    });
  });

  // ─── Public Banners ─────────────────────────────────────────────

  describe('Banners (public)', () => {
    it('GET /api/banner should return banners', () => {
      return request(server).get('/api/banner').expect(200);
    });

    it('GET /api/banner?device_type=desktop should filter by device type', () => {
      return request(server).get('/api/banner?device_type=desktop').expect(200);
    });
  });

  // ─── Public Projects ────────────────────────────────────────────

  describe('Projects (public)', () => {
    it('GET /api/projects/public should return active projects', () => {
      return request(server).get('/api/projects/public').expect(200);
    });
  });

  // ─── Public FAQs ────────────────────────────────────────────────

  describe('FAQs (public)', () => {
    it('GET /api/faqs/active should return active FAQs', () => {
      return request(server).get('/api/faqs/active').expect(200);
    });

    it('GET /api/faqs/categories should return FAQ categories', () => {
      return request(server).get('/api/faqs/categories').expect(200);
    });
  });

  // ─── Public Blogs ───────────────────────────────────────────────

  describe('Blogs (public)', () => {
    it('GET /api/blogs/published should return published blogs', () => {
      return request(server).get('/api/blogs/published').expect(200);
    });
  });

  // ─── Protected Routes (should require auth) ────────────────────

  describe('Protected routes (no token)', () => {
    it('GET /api/statistics/basic should return 401', () => {
      return request(server).get('/api/statistics/basic').expect(401);
    });

    it('GET /api/activity-logs should return 401', () => {
      return request(server).get('/api/activity-logs').expect(401);
    });

    it('GET /api/settings should return 401', () => {
      return request(server).get('/api/settings').expect(401);
    });

    it('GET /api/email-templates should return 401', () => {
      return request(server).get('/api/email-templates').expect(401);
    });

    it('GET /api/orders/all should return 401', () => {
      return request(server).get('/api/orders/all').expect(401);
    });

    it('GET /api/products/count should return 401', () => {
      return request(server).get('/api/products/count').expect(401);
    });

    it('GET /api/categories/count should return 401', () => {
      return request(server).get('/api/categories/count').expect(401);
    });
  });
});
