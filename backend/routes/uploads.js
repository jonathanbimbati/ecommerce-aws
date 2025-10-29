const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const jwtAuth = require('../middleware/jwtAuth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Require auth for all upload routes
router.use(jwtAuth);

function getS3Config() {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const bucket = process.env.S3_BUCKET || process.env.UPLOADS_BUCKET;
  const publicBase = process.env.S3_PUBLIC_URL_BASE || '';
  const prefix = process.env.S3_PREFIX || 'public/';
  if (!bucket) throw new Error('S3_BUCKET env var not set');
  return { region, bucket, publicBase, prefix };
}

// POST /api/uploads/presign
// Body: { fileName: string, contentType: string, size?: number }
// Response: { uploadUrl, method: 'PUT', headers: { 'Content-Type': ... }, key, objectUrl }
router.post('/presign', async (req, res) => {
  try {
    const { fileName, contentType, size } = req.body || {};
    if (!fileName || !contentType) return res.status(400).json({ error: 'fileName and contentType are required' });

    // Enforce content-type and size limits
    const allowed = new Set(['image/png', 'image/jpeg']);
    const maxBytes = parseInt(process.env.MAX_UPLOAD_BYTES || String(5 * 1024 * 1024), 10); // default 5MB
    if (!allowed.has(String(contentType).toLowerCase())) {
      return res.status(415).json({ error: 'Unsupported media type. Only PNG and JPEG are allowed.' });
    }
    if (typeof size === 'number' && size > maxBytes) {
      return res.status(413).json({ error: `File too large. Max ${Math.floor(maxBytes/1024/1024)}MB.` });
    }

    const { region, bucket, publicBase, prefix } = getS3Config();
    const ext = (fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '').toLowerCase();
    const key = `${prefix}${uuidv4()}${ext}`;

    const s3 = new S3Client({ region });
    const putParams = { Bucket: bucket, Key: key, ContentType: contentType };
    if (typeof size === 'number' && size > 0) {
      // When included in the signature, client PUT must match this content-length
      putParams.ContentLength = size;
    }
    const command = new PutObjectCommand(putParams);
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

    // Compute a public object URL when possible
    let objectUrl = '';
    if (publicBase) {
      objectUrl = publicBase.replace(/\/$/, '') + '/' + key;
    } else {
      // Default to virtual-hosted–style URL
      objectUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    }

    return res.json({ uploadUrl, method: 'PUT', headers: { 'Content-Type': contentType }, key, objectUrl, expiresIn: 60, maxBytes });
  } catch (err) {
    console.error('Error generating S3 presign:', err);
    const msg = err && err.message ? err.message : 'Internal server error';
    return res.status(500).json({ error: msg });
  }
});

module.exports = router;
