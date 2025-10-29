const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/dynamo');

const router = express.Router();

// Simple in-memory fallback if DYNAMODB_TABLE isn't configured (seed lazily)
const products = new Map();

function ensureSeeded() {
  if (products.size === 0) {
    const seedProducts = [
      { id: uuidv4(), name: 'Camiseta', price: 39.9, description: 'Camiseta 100% algodão' },
      { id: uuidv4(), name: 'Caneca', price: 19.9, description: 'Caneca de cerâmica 300ml' }
    ];
    seedProducts.forEach(p => products.set(p.id, p));
  }
}

// GET /api/products
router.get('/', async (req, res) => {
  try {
    if (process.env.DYNAMODB_TABLE) {
      const items = await db.listProducts();
      return res.json(items);
    }
    ensureSeeded();
    return res.json(Array.from(products.values()));
  } catch (err) {
    console.error('Error listing products:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    if (process.env.DYNAMODB_TABLE) {
      const item = await db.getProduct(req.params.id);
      if (!item) return res.status(404).json({ error: 'Product not found' });
      return res.json(item);
    }
    ensureSeeded();
    const p = products.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    return res.json(p);
  } catch (err) {
    console.error('Error getting product:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const jwtAuth = require('../middleware/jwtAuth');

// POST /api/products
router.post('/', jwtAuth, async (req, res) => {
  const { name, price, description, imageUrl } = req.body;
  if (!name || typeof price !== 'number') {
    return res.status(400).json({ error: 'Invalid payload: name and numeric price required' });
  }
  const item = { id: uuidv4(), name, price, description: description || '', imageUrl: imageUrl || '' };
  try {
    if (process.env.DYNAMODB_TABLE) {
      await db.createProduct(item);
      return res.status(201).json(item);
    }
    ensureSeeded();
    products.set(item.id, item);
    return res.status(201).json(item);
  } catch (err) {
    console.error('Error creating product:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/products/:id
router.put('/:id', jwtAuth, async (req, res) => {
  const updates = {};
  const allowed = ['name', 'price', 'description', 'imageUrl'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields provided for update' });
  try {
    if (process.env.DYNAMODB_TABLE) {
      const updated = await db.updateProduct(req.params.id, updates);
      if (!updated) return res.status(404).json({ error: 'Product not found' });
      return res.json(updated);
    }
    ensureSeeded();
    const existing = products.get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    Object.assign(existing, updates);
    products.set(existing.id, existing);
    return res.json(existing);
  } catch (err) {
    console.error('Error updating product:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', jwtAuth, async (req, res) => {
  try {
    if (process.env.DYNAMODB_TABLE) {
      const item = await db.getProduct(req.params.id);
      if (!item) return res.status(404).json({ error: 'Product not found' });
      await db.deleteProduct(req.params.id);
      return res.status(204).send();
    }
    ensureSeeded();
    const existed = products.delete(req.params.id);
    if (!existed) return res.status(404).json({ error: 'Product not found' });
    return res.status(204).end();
  } catch (err) {
    console.error('Error deleting product:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
