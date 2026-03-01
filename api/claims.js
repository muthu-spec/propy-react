// Vercel Serverless Function for Claims API - Root Route (/api/claims)
// Uses Vercel Blob for persistent storage

import { put, list, del } from '@vercel/blob';

// In-memory fallback for local development
if (!globalThis.inMemoryClaims) {
  globalThis.inMemoryClaims = {};
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  // Disable caching for real-time claims data (critical to prevent duplicate claims)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  console.log('[Claims API Root] Request received:', {
    method: req.method,
    url: req.url,
  });

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
    res.status(200).end();
    return;
  }

  const method = req.method;

  try {
    if (method === 'GET') {
      // GET /api/claims - List all event files
      console.log('Listing all claims events');

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        const { blobs } = await list({
          prefix: 'potluck-claims-',
          token,
        });
        console.log('All claims blobs:', blobs.length);
        // Handle GUID in filename: potluck-claims-{eventId}-{guid}.json
        return res.json(blobs.map(b => {
          const filename = b.pathname.replace('potluck-claims-', '').replace('.json', '');
          // Extract eventId (part before dash/GUID)
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

    if (method === 'POST') {
      // POST /api/claims - Create a new claim
      console.log('POST request body:', req.body);

      const { eventId, itemId, guestName } = req.body;

      if (!eventId || !itemId || !guestName) {
        console.log('Missing required fields');
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get current claims for this event
      let currentClaims = globalThis.inMemoryClaims[eventId] || [];
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        const prefix = `potluck-claims-${eventId}-`;
        const { blobs } = await list({ prefix, token });

        if (blobs.length > 0) {
          const response = await fetch(blobs[0].url);
          const text = await response.text();
          currentClaims = text ? JSON.parse(text) : [];
        }
      }

      console.log('Current claims:', currentClaims);

      // Check if item is already claimed
      const existingClaim = currentClaims.find(c => c.eventId === eventId && c.itemId === itemId);
      if (existingClaim) {
        console.log('Item already claimed by:', existingClaim.guestName);
        return res.status(409).json({ error: 'Item already claimed', claimedBy: existingClaim.guestName });
      }

      // Check if guest already claimed an item
      const guestExistingClaim = currentClaims.find(c => c.eventId === eventId && c.guestName === guestName);
      if (guestExistingClaim) {
        console.log('Guest already claimed item:', guestExistingClaim.itemId);
        return res.status(409).json({ error: 'Guest already claimed an item', itemId: guestExistingClaim.itemId });
      }

      const newClaim = {
        eventId,
        itemId,
        guestName,
        claimTime: new Date().toISOString()
      };

      console.log('Creating new claim:', newClaim);

      currentClaims.push(newClaim);

      // Save claims to blob
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          const token = process.env.BLOB_READ_WRITE_TOKEN;
          const pathname = `potluck-claims-${eventId}-${Date.now()}.json`;

          console.log('Saving claims to:', pathname);

          await put(pathname, JSON.stringify(currentClaims), {
            token,
            contentType: 'application/json',
            access: 'public',
          });

          console.log('Claims saved successfully');
        } catch (error) {
          console.error('Failed to save claims to blob:', error);
          throw new Error(`Failed to save claims to blob storage: ${error.message}`);
        }
      } else {
        console.log('BLOB_READ_WRITE_TOKEN not set');
      }

      // Always update in-memory fallback
      globalThis.inMemoryClaims[eventId] = currentClaims;

      return res.status(201).json(newClaim);
    }

    if (method === 'PUT') {
      // PUT /api/claims - Modify claims (remove or update)
      console.log('PUT request body:', req.body);

      const { eventId, itemId, action } = req.body;

      if (!eventId) {
        console.log('Event ID required');
        return res.status(400).json({ error: 'Event ID required' });
      }

      // Get current claims for this event
      let currentClaims = globalThis.inMemoryClaims[eventId] || [];
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        const prefix = `potluck-claims-${eventId}-`;
        const { blobs } = await list({ prefix, token });

        if (blobs.length > 0) {
          const response = await fetch(blobs[0].url);
          const text = await response.text();
          currentClaims = text ? JSON.parse(text) : [];
        }
      }

      console.log('Current claims before action:', currentClaims);

      // Clear all claims for an event
      if (action === 'clear') {
        console.log('Clearing all claims for event:', eventId);

        // Delete all blob files for this event
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        const prefix = `potluck-claims-${eventId}-`;

        if (token) {
          const { blobs } = await list({ prefix, token });
          for (const blob of blobs) {
            await del(blob.pathname, { token });
          }
        }

        globalThis.inMemoryClaims[eventId] = [];
        return res.json({ success: true });
      }

      // Remove a specific claim
      if (action === 'remove' && itemId) {
        const claimIndex = currentClaims.findIndex(c => c.eventId === eventId && c.itemId === itemId);
        if (claimIndex === -1) {
          console.log('Claim not found:', { eventId, itemId });
          return res.status(404).json({ error: 'Claim not found' });
        }
        console.log('Removing claim at index:', claimIndex);
        currentClaims.splice(claimIndex, 1);

        // Save updated claims
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          try {
            const token = process.env.BLOB_READ_WRITE_TOKEN;
            const pathname = `potluck-claims-${eventId}-${Date.now()}.json`;

            await put(pathname, JSON.stringify(currentClaims), {
              token,
              contentType: 'application/json',
              access: 'public',
            });

            console.log('Claims saved successfully');
          } catch (error) {
            console.error('Failed to save claims to blob:', error);
            throw new Error(`Failed to save claims to blob storage: ${error.message}`);
          }
        }

        globalThis.inMemoryClaims[eventId] = currentClaims;
        return res.json({ success: true });
      }

      console.log('Invalid action:', action);
      return res.status(400).json({ error: 'Invalid action. Use "clear" or "remove"' });
    }
  } catch (error) {
    console.error('Claims API Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  console.log('No route matched:', { method });
  return res.status(404).json({ error: 'Not found' });
}
