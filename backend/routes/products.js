const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// In-memory products store
const products = new Map();

// Seed with a couple of products
const seedProducts = [
  { id: uuidv4(), name: 'Camiseta', price: 39.9, description: 'Camiseta 100% algodão' },
  { id: uuidv4(), name: 'Caneca', price: 19.9, description: 'Caneca de cerâmica 300ml' }
];
seedProducts.forEach(p => products.set(p.id, p));

// GET /api/products
router.get('/', (req, res) => {
  const list = Array.from(products.values());
  res.json(list);
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const p = products.get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
});

// POST /api/products
router.post('/', (req, res) => {
  const { name, price, description } = req.body;
  if (!name || typeof price !== 'number') {
    return res.status(400).json({ error: 'Invalid payload: name and price required' });
  }
  const p = { id: uuidv4(), name, price, description: description || '' };
  products.set(p.id, p);
  res.status(201).json(p);
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  const existing = products.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  const { name, price, description } = req.body;
  if (name !== undefined) existing.name = name;
  if (price !== undefined) existing.price = price;
  if (description !== undefined) existing.description = description;
  products.set(existing.id, existing);
  res.json(existing);
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  const existed = products.delete(req.params.id);
  if (!existed) return res.status(404).json({ error: 'Product not found' });
  res.status(204).end();
});

module.exports = router;
