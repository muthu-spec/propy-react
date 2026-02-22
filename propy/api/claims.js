// Vercel Serverless Function for Claims API
// Uses Vercel Blob for persistent storage
// One JSON file per eventId: potluck-claims-{eventId}.json

// Helper to get claims for a specific event
async function getClaimsForEvent(eventId) {
  try {
    // Check if running in Vercel environment
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { list } = await import('@vercel/blob');
      const token = process.env.BLOB_READ_WRITE_TOKEN;

      const pathname = `potluck-claims-${eventId}.json`;

      // Try to get the event's blob
      const response = await fetch(`https://vercel-blob.public.blob.vercel-storage.com/${pathname}`);
      if (response.ok) {
        const data = await response.text();
        return data ? JSON.parse(data) : [];
      }
    }
  } catch (error) {
    console.error('Failed to get claims from Blob:', error);
  }
  // Fallback to in-memory (for local development)
  if (!globalThis.inMemoryClaims) {
    globalThis.inMemoryClaims = {};
  }
  return globalThis.inMemoryClaims[eventId] || [];
}

// Helper to save claims for a specific event (overwrites existing file)
async function saveClaimsForEvent(eventId, claims) {
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob');
      const token = process.env.BLOB_READ_WRITE_TOKEN;

      // Fixed filename per event - overwrites existing file
      const pathname = `potluck-claims-${eventId}.json`;

      // Upload claims as a new blob (overwrites if exists)
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
  if (!globalThis.inMemoryClaims) {
    globalThis.inMemoryClaims = {};
  }
  globalThis.inMemoryClaims[eventId] = claims;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Debug logging
  console.log('Request:', { method: req.method, url: req.url });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const method = req.method;
  const url = req.url;

  // Parse URL: split by / and filter empty strings
  const urlParts = url.split('/').filter(p => p.trim());

  // Root route for listing events
  const isRootClaimsRoute = url === '/api/claims' || url === '/api/claims/';

  try {
    if (method === 'GET') {
      // GET /api/claims - List all event files
      if (isRootClaimsRoute) {
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const { list } = await import('@vercel/blob');
          const token = process.env.BLOB_READ_WRITE_TOKEN;
          const { blobs } = await list({
            prefix: 'potluck-claims-',
            token,
          });
          // Return list of event files with metadata
          return res.json(blobs.blobs.map(b => ({
            eventId: b.pathname.replace('potluck-claims-', '').replace('.json', ''),
            uploadedAt: b.uploadedAt,
            size: b.size,
          })));
        }
        // Fallback to in-memory events
        const events = Object.keys(globalThis.inMemoryClaims || {}).map(eventId => ({
          eventId,
          claimCount: (globalThis.inMemoryClaims[eventId] || []).length,
        }));
        return res.json(events);
      }

      // GET /api/claims/:eventId/items/:itemId - Must check before /:eventId route
      if (urlParts.length >= 5 && urlParts[3] === 'items') {
        const eventId = decodeURIComponent(urlParts[2]);
        const itemId = decodeURIComponent(urlParts[4]);
        const claims = await getClaimsForEvent(eventId);
        const claim = claims.find(c => c.eventId === eventId && c.itemId === itemId);
        return res.json({ claimedBy: claim?.guestName || null });
      }

      // GET /api/claims/:eventId/guests/:guestName - Must check before /:eventId route
      if (urlParts.length >= 5 && urlParts[3] === 'guests') {
        const eventId = decodeURIComponent(urlParts[2]);
        const guestName = decodeURIComponent(urlParts[4]);
        const claims = await getClaimsForEvent(eventId);
        const guestClaims = claims.filter(c => c.eventId === eventId && c.guestName === guestName);
        return res.json(guestClaims);
      }

      // GET /api/claims/:eventId
      if (urlParts.length >= 3 && urlParts[0] === 'api' && urlParts[1] === 'claims') {
        const eventId = decodeURIComponent(urlParts[2]);
        const claims = await getClaimsForEvent(eventId);
        return res.json(claims);
      }
    }

    if (method === 'POST') {
      // POST /api/claims - Must be root route
      if (isRootClaimsRoute) {
        const { eventId, itemId, guestName } = req.body;

        if (!eventId || !itemId || !guestName) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get current claims for this event
        const currentClaims = await getClaimsForEvent(eventId);

        // Check if item is already claimed
        const existingClaim = currentClaims.find(c => c.eventId === eventId && c.itemId === itemId);
        if (existingClaim) {
          return res.status(409).json({ error: 'Item already claimed', claimedBy: existingClaim.guestName });
        }

        // Check if guest already claimed an item
        const guestExistingClaim = currentClaims.find(c => c.eventId === eventId && c.guestName === guestName);
        if (guestExistingClaim) {
          return res.status(409).json({ error: 'Guest already claimed an item', itemId: guestExistingClaim.itemId });
        }

        const newClaim = {
          eventId,
          itemId,
          guestName,
          claimTime: new Date().toISOString()
        };

        currentClaims.push(newClaim);
        await saveClaimsForEvent(eventId, currentClaims);
        return res.status(201).json(newClaim);
      }
    }

    if (method === 'DELETE') {
      // DELETE /api/claims - Clear all claims for an event
      if (isRootClaimsRoute) {
        const { eventId } = req.body;
        if (eventId) {
          await saveClaimsForEvent(eventId, []);
          return res.json({ success: true });
        }
        // If no eventId, return error
        return res.status(400).json({ error: 'Event ID required for clearing claims' });
      }

      // DELETE /api/claims/:eventId/items/:itemId
      if (urlParts.length >= 5 && urlParts[3] === 'items') {
        const eventId = decodeURIComponent(urlParts[2]);
        const itemId = decodeURIComponent(urlParts[4]);

        const currentClaims = await getClaimsForEvent(eventId);
        const claimIndex = currentClaims.findIndex(c => c.eventId === eventId && c.itemId === itemId);
        if (claimIndex === -1) {
          return res.status(404).json({ error: 'Claim not found' });
        }

        currentClaims.splice(claimIndex, 1);
        await saveClaimsForEvent(eventId, currentClaims);
        return res.json({ success: true });
      }
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  return res.status(404).json({ error: 'Not found' });
}
