const express = require('express');
const db = require('../db/dynamo');
const usersDb = require('../db/users');

const router = express.Router();

router.get('/tables', (req, res) => {
  res.json({
    DYNAMODB_TABLE: db.TABLE_NAME || null,
    USERS_TABLE: usersDb.TABLE_NAME || null,
    REGION: db.REGION || null
  });
});

module.exports = router;
