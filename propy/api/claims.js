// Vercel Serverless Function for Claims API
// Uses Vercel Blob for persistent storage

let blobClient = null;

// Initialize Blob when available
async function initBlob() {
  if (!blobClient) {
    try {
      // Check if running in Vercel environment
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob');
        blobClient = put({
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
      }
    } catch (error) {
      console.error('Blob initialization failed:', error);
    }
  }
  return blobClient;
}

// Helper to get all claims
async function getClaims() {
  const blob = await initBlob();
  if (blob) {
    try {
      // Try to get the claims blob
      const { blobs } = await blob.list({
        prefix: 'potluck-claims-',
      });

      if (blobs.length > 0) {
        // Get the latest blob (sorted by uploadedAt)
        const sortedBlobs = blobs.sort((a, b) => {
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        });
        const latestBlob = sortedBlobs[0];

        // Get blob content
        const { url } = await blob.get(latestBlob.pathname);
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.text();
          return data ? JSON.parse(data) : [];
        }
      }
    } catch (error) {
      console.error('Failed to get claims from Blob:', error);
    }
  }
  // Fallback to in-memory (for local development)
  if (!globalThis.inMemoryClaims) {
    globalThis.inMemoryClaims = [];
  }
  return globalThis.inMemoryClaims;
}

// Helper to save all claims
async function saveClaims(claims) {
  const blob = await initBlob();
  if (blob) {
    try {
      // Create a blob with timestamp for versioning
      const timestamp = Date.now();
      const pathname = `potluck-claims-${timestamp}.json`;

      // Upload claims as a new blob
      await blob.put(pathname, JSON.stringify(claims), {
        contentType: 'application/json',
        access: 'public',
      });

      // Clean up old blobs (keep only last 10)
      const { blobs } = await blob.list({
        prefix: 'potluck-claims-',
      });

      if (blobs.length > 10) {
        const sortedBlobs = blobs.sort((a, b) => {
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        });
        const oldBlobs = sortedBlobs.slice(10);
        for (const oldBlob of oldBlobs) {
          try {
            await blob.delete(oldBlob.pathname);
          } catch (error) {
            console.error('Failed to delete old blob:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to save claims to Blob:', error);
    }
  }
  // Always update in-memory fallback
  globalThis.inMemoryClaims = claims;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req;
  const method = req.method;

  // Parse URL to get path segments
  // Remove leading '/api' if present and trailing slashes
  const pathWithoutApi = url.replace(/^\/api/, '').replace(/^\//, '').replace(/\/$/, '');
  const pathParts = pathWithoutApi.split('/').filter(p => p);

  try {
    const claims = await getClaims();

    if (method === 'GET') {
      // GET /api/claims or /api/claims/
      if (pathParts.length === 0 || (pathParts.length === 1 && pathParts[0] === '')) {
        return res.json(claims);
      }

      // GET /api/claims/:eventId
      if (pathParts.length === 1) {
        const eventId = decodeURIComponent(pathParts[0]);
        const eventClaims = claims.filter(c => c.eventId === eventId);
        return res.json(eventClaims);
      }

      // GET /api/claims/:eventId/items/:itemId
      if (pathParts.length === 3 && pathParts[1] === 'items') {
        const eventId = decodeURIComponent(pathParts[0]);
        const itemId = decodeURIComponent(pathParts[2]);
        const claim = claims.find(c => c.eventId === eventId && c.itemId === itemId);
        return res.json({ claimedBy: claim?.guestName || null });
      }

      // GET /api/claims/:eventId/guests/:guestName
      if (pathParts.length === 3 && pathParts[1] === 'guests') {
        const eventId = decodeURIComponent(pathParts[0]);
        const guestName = decodeURIComponent(pathParts[2]);
        const guestClaims = claims.filter(c => c.eventId === eventId && c.guestName === guestName);
        return res.json(guestClaims);
      }
    }

    if (method === 'POST') {
      // POST /api/claims or /api/claims/
      if (pathParts.length === 0 || (pathParts.length === 1 && pathParts[0] === '')) {
        const body = await req.json();
        const { eventId, itemId, guestName } = body;

        if (!eventId || !itemId || !guestName) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if item is already claimed
        const existingClaim = claims.find(c => c.eventId === eventId && c.itemId === itemId);
        if (existingClaim) {
          return res.status(409).json({ error: 'Item already claimed', claimedBy: existingClaim.guestName });
        }

        // Check if guest already claimed an item
        const guestExistingClaim = claims.find(c => c.eventId === eventId && c.guestName === guestName);
        if (guestExistingClaim) {
          return res.status(409).json({ error: 'Guest already claimed an item', itemId: guestExistingClaim.itemId });
        }

        const newClaim = {
          eventId,
          itemId,
          guestName,
          claimTime: new Date().toISOString()
        };

        claims.push(newClaim);
        await saveClaims(claims);
        return res.status(201).json(newClaim);
      }
    }

    if (method === 'DELETE') {
      // DELETE /api/claims or /api/claims/
      if (pathParts.length === 0 || (pathParts.length === 1 && pathParts[0] === '')) {
        await saveClaims([]);
        return res.json({ success: true });
      }

      // DELETE /api/claims/:eventId/items/:itemId
      if (pathParts.length === 3 && pathParts[1] === 'items') {
        const eventId = decodeURIComponent(pathParts[0]);
        const itemId = decodeURIComponent(pathParts[2]);

        const claimIndex = claims.findIndex(c => c.eventId === eventId && c.itemId === itemId);
        if (claimIndex === -1) {
          return res.status(404).json({ error: 'Claim not found' });
        }

        claims.splice(claimIndex, 1);
        await saveClaims(claims);
        return res.json({ success: true });
      }
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  return res.status(404).json({ error: 'Not found' });
}
