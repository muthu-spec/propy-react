// Vercel Serverless Function for Claims API
// Uses Vercel Blob for persistent storage

// Helper to get all claims
async function getClaims() {
  try {
    // Check if running in Vercel environment
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { list } = await import('@vercel/blob');
      const token = process.env.BLOB_READ_WRITE_TOKEN;

      // List all blobs with prefix
      const blobs = await list({
        prefix: 'potluck-claims-',
        token,
      });

      if (blobs.blobs.length > 0) {
        // Get the latest blob (sorted by uploadedAt)
        const sortedBlobs = blobs.blobs.sort((a, b) => {
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
        });
        const latestBlob = sortedBlobs[0];

        // Get blob content directly via its url
        const response = await fetch(latestBlob.url);
        if (response.ok) {
          const data = await response.text();
          return data ? JSON.parse(data) : [];
        }
      }
    }
  } catch (error) {
    console.error('Failed to get claims from Blob:', error);
  }
  // Fallback to in-memory (for local development)
  if (!globalThis.inMemoryClaims) {
    globalThis.inMemoryClaims = [];
  }
  return globalThis.inMemoryClaims;
}

// Helper to save all claims
async function saveClaims(claims) {
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob');
      const token = process.env.BLOB_READ_WRITE_TOKEN;

      // Create a blob with timestamp for versioning
      const timestamp = Date.now();
      const pathname = `potluck-claims-${timestamp}.json`;

      // Upload claims as a new blob
      await put(pathname, JSON.stringify(claims), {
        token,
        contentType: 'application/json',
        access: 'public',
      });
    }
  } catch (error) {
    console.error('Failed to save claims to Blob:', error);
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

  const method = req.method;
  const url = req.url;

  // Simple path matching
  const isRootClaimsRoute = url === '/api/claims' || url === '/api/claims/';

  try {
    const claims = await getClaims();

    if (method === 'GET') {
      // GET /api/claims
      if (isRootClaimsRoute) {
        return res.json(claims);
      }

      // GET /api/claims/:eventId
      const eventIdMatch = url.match(/^\/api\/claims\/([^\/]+)$/);
      if (eventIdMatch) {
        const eventId = decodeURIComponent(eventIdMatch[1]);
        const eventClaims = claims.filter(c => c.eventId === eventId);
        return res.json(eventClaims);
      }

      // GET /api/claims/:eventId/items/:itemId
      const itemMatch = url.match(/^\/api\/claims\/([^\/]+)\/items\/([^\/]+)$/);
      if (itemMatch) {
        const eventId = decodeURIComponent(itemMatch[1]);
        const itemId = decodeURIComponent(itemMatch[2]);
        const claim = claims.find(c => c.eventId === eventId && c.itemId === itemId);
        return res.json({ claimedBy: claim?.guestName || null });
      }

      // GET /api/claims/:eventId/guests/:guestName
      const guestMatch = url.match(/^\/api\/claims\/([^\/]+)\/guests\/([^\/]+)$/);
      if (guestMatch) {
        const eventId = decodeURIComponent(guestMatch[1]);
        const guestName = decodeURIComponent(guestMatch[2]);
        const guestClaims = claims.filter(c => c.eventId === eventId && c.guestName === guestName);
        return res.json(guestClaims);
      }
    }

    if (method === 'POST') {
      // POST /api/claims
      if (isRootClaimsRoute) {
        const { eventId, itemId, guestName } = req.body;

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
      // DELETE /api/claims
      if (isRootClaimsRoute) {
        await saveClaims([]);
        return res.json({ success: true });
      }

      // DELETE /api/claims/:eventId/items/:itemId
      const itemMatch = url.match(/^\/api\/claims\/([^\/]+)\/items\/([^\/]+)$/);
      if (itemMatch) {
        const eventId = decodeURIComponent(itemMatch[1]);
        const itemId = decodeURIComponent(itemMatch[2]);

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
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  return res.status(404).json({ error: 'Not found' });
}
