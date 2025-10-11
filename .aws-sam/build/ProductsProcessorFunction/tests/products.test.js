import request from 'supertest';
import app from '../index';

describe('Products API', () => {
  let createdProduct;

  it('GET /api/products should return array', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/products should create product', async () => {
    const payload = { name: 'Teste', price: 12.5, description: 'Produto de teste' };
    const res = await request(app).post('/api/products').send(payload);
    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(payload.name);
    createdProduct = res.body;
  });

  it('GET /api/products/:id should return the created product', async () => {
    const res = await request(app).get(`/api/products/${createdProduct.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(createdProduct.id);
  });

  it('PUT /api/products/:id should update the product', async () => {
    const res = await request(app)
      .put(`/api/products/${createdProduct.id}`)
      .send({ price: 99.9 });
    expect(res.statusCode).toBe(200);
    expect(res.body.price).toBe(99.9);
  });

  it('DELETE /api/products/:id should delete the product', async () => {
    const res = await request(app).delete(`/api/products/${createdProduct.id}`);
    expect(res.statusCode).toBe(204);
  });

  it('GET /api/products/:id should return 404 after delete', async () => {
    const res = await request(app).get(`/api/products/${createdProduct.id}`);
    expect(res.statusCode).toBe(404);
  });
});
