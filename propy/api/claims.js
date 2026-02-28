// Vercel Serverless Function for Claims API
// Uses Vercel Blob for persistent storage
// One JSON file per eventId: potluck-claims-{eventId}.json

import { put, del, list } from '@vercel/blob';

// Helper to get claims for a specific event
async function getClaimsForEvent(eventId) {
  try {
    // Check if running in Vercel environment
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const prefix = `potluck-claims-${eventId}-`;

      // List all blobs with the prefix (Vercel appends GUID to filename)
      const { list } = await import('@vercel/blob');
      const { blobs } = await list({
        prefix,
        token,
      });

      // Get the first matching blob (most recent)
      if (blobs.length > 0) {
        const { get } = await import('@vercel/blob');
        const blob = await get(blobs[0].pathname, { access: 'public', token });

        if (blob) {
          const text = await blob.stream.text();
          return text ? JSON.parse(text) : [];
        }
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

// Helper to save claims for a specific event (deletes old files with GUID suffix)
async function saveClaimsForEvent(eventId, claims) {
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const prefix = `potluck-claims-${eventId}-`;

      // List and delete existing files with the same prefix
      const { list, del } = await import('@vercel/blob');
      const { blobs } = await list({
        prefix,
        token,
      });

      // Delete all existing files for this event
      for (const blob of blobs) {
        await del(blob.pathname, { token });
      }

      // Create new filename (Vercel will append GUID automatically)
      const pathname = `${prefix}${Date.now()}.json`;

      // Upload claims using SDK put method
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  // Debug logging
  console.log('Request:', { method: req.method, url: req.url, headers: req.headers });

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
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
      console.log('GET request - url:', url, 'urlParts:', urlParts, 'isRootClaimsRoute:', isRootClaimsRoute);

      // GET /api/claims - List all event files
      if (isRootClaimsRoute) {
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const token = process.env.BLOB_READ_WRITE_TOKEN;
          const { blobs } = await list({
            prefix: 'potluck-claims-',
            token,
          });
          // Return list of event files with metadata
          // Handle GUID in filename: potluck-claims-{eventId}-{guid}.json
          return res.json(blobs.map(b => {
            const filename = b.pathname.replace('potluck-claims-', '').replace('.json', '');
            // Extract eventId (part before the dash/GUID)
            const eventId = filename.split('-')[0];
            return {
              eventId,
              uploadedAt: b.uploadedAt,
              size: b.size,
              pathname: b.pathname,
            };
          }));
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
        console.log('GET guest claims:', { eventId, guestName, urlParts });
        const claims = await getClaimsForEvent(eventId);
        const guestClaims = claims.filter(c => c.eventId === eventId && c.guestName === guestName);
        console.log('Guest claims found:', guestClaims);
        return res.json(guestClaims);
      }

      // GET /api/claims/:eventId
      if (urlParts.length >= 3 && urlParts[0] === 'api' && urlParts[1] === 'claims' && urlParts[2]) {
        // Only match if not already matched by items or guests routes
        // Check that there's no 'items' or 'guests' segment at index 3
        if (!urlParts[3] || (urlParts[3] !== 'items' && urlParts[3] !== 'guests')) {
          const eventId = decodeURIComponent(urlParts[2]);
          console.log('GET claims for event:', eventId);
          const claims = await getClaimsForEvent(eventId);
          return res.json(claims);
        }
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

    if (method === 'PUT') {
      console.log('PUT request - url:', url, 'urlParts:', urlParts);

      // PUT /api/claims - Modify claims (remove or update)
      if (isRootClaimsRoute) {
        const { eventId, itemId, action } = req.body;

        if (!eventId) {
          return res.status(400).json({ error: 'Event ID required' });
        }

        const currentClaims = await getClaimsForEvent(eventId);

        // Clear all claims for an event
        if (action === 'clear') {
          await saveClaimsForEvent(eventId, []);
          return res.json({ success: true });
        }

        // Remove a specific claim
        if (action === 'remove' && itemId) {
          const claimIndex = currentClaims.findIndex(c => c.eventId === eventId && c.itemId === itemId);
          if (claimIndex === -1) {
            return res.status(404).json({ error: 'Claim not found' });
          }
          currentClaims.splice(claimIndex, 1);
          await saveClaimsForEvent(eventId, currentClaims);
          return res.json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid action. Use "clear" or "remove"' });
      }
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  console.log('No route matched:', { method, url, urlParts });
  return res.status(404).json({ error: 'Not found' });
}
