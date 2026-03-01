// Vercel Serverless Function for Claims API
// Uses Vercel Blob for persistent storage
// One JSON file per eventId: potluck-claims-{eventId}.json

import { put, list, del } from '@vercel/blob';

// In-memory fallback for local development
if (!globalThis.inMemoryClaims) {
  globalThis.inMemoryClaims = {};
}

// Helper to get claims for a specific event
async function getClaimsForEvent(eventId) {
  console.log('Getting claims for eventId:', eventId);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const prefix = `potluck-claims-${eventId}-`;

    console.log('Searching for blobs with prefix:', prefix);

    // List all blobs with prefix (handles GUID suffix)
    const { blobs } = await list({ prefix, token });

    console.log('Found blobs:', blobs.length, blobs.map(b => b.pathname));

    // Get first matching blob (most recent)
    if (blobs.length > 0) {
      const blob = blobs[0];
      console.log('Got blob:', blob.pathname);

      // Fetch blob content using its URL
      const response = await fetch(blob.url);
      const text = await response.text();
      const data = text ? JSON.parse(text) : [];
      console.log('Parsed claims data:', data);
      return data;
    } else {
      console.log('No blobs found for eventId:', eventId);
    }
  } else {
    console.log('BLOB_READ_WRITE_TOKEN not set');
  }
  // Fallback to in-memory (for local development)
  return globalThis.inMemoryClaims[eventId] || [];
}

// Helper to save claims for a specific event
async function saveClaimsForEvent(eventId, claims) {
  console.log('Saving claims for eventId:', eventId);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const prefix = `potluck-claims-${eventId}-`;

    console.log('Listing blobs with prefix:', prefix);

    // List and delete existing files with the same prefix
    const { blobs } = await list({ prefix, token });

    console.log('Found existing blobs:', blobs.length);

    // Delete all existing files for this event
    for (const blob of blobs) {
      console.log('Deleting blob:', blob.pathname);
      await del(blob.pathname, { token });
    }

    // Create new filename with timestamp
    const pathname = `${prefix}${Date.now()}.json`;

    console.log('Saving claims to:', pathname);

    await put(pathname, JSON.stringify(claims), {
      token,
      contentType: 'application/json',
      access: 'public',
    });

    console.log('Claims saved successfully');
  } else {
    console.log('BLOB_READ_WRITE_TOKEN not set');
  }
  // Always update in-memory fallback
  globalThis.inMemoryClaims[eventId] = claims;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  // Disable caching for real-time claims data (critical to prevent duplicate claims)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  // Debug logging
  console.log('Claims API Request:', { method: req.method, url: req.url });

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
    res.status(200).end();
    return;
  }

  const method = req.method;
  const url = req.url;

  // Parse URL: split by / and filter empty strings
  const urlParts = url.split('/').filter(p => p.trim());

  console.log('Parsed URL parts:', urlParts);

  // For catch-all route: /api/claims/* or /api/claims
  // req.url contains the path after /api/claims
  const isRootClaimsRoute = url === '/' || url === '';

  console.log('isRootClaimsRoute:', isRootClaimsRoute);

  try {
    if (method === 'GET') {
      console.log('GET request - url:', url, 'urlParts:', urlParts, 'isRootClaimsRoute:', isRootClaimsRoute);

      // GET /api/claims - List all event files
      if (isRootClaimsRoute) {
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

      // GET /api/claims/:eventId/items/:itemId - Must check before /:eventId route
      // In Vercel serverless functions, req.url is '/:eventId/items/:itemId'
      if (urlParts.length >= 3 && urlParts[1] === 'items') {
        const eventId = decodeURIComponent(urlParts[0]);
        const itemId = decodeURIComponent(urlParts[2]);
        console.log('GET item claim:', { eventId, itemId, urlParts });
        const claims = await getClaimsForEvent(eventId);
        const claim = claims.find(c => c.eventId === eventId && c.itemId === itemId);
        console.log('Item claim:', claim);
        return res.json({ claimedBy: claim?.guestName || null });
      }

      // GET /api/claims/:eventId/guests/:guestName - Must check before /:eventId route
      // In Vercel serverless functions, req.url is '/:eventId/guests/:guestName'
      if (urlParts.length >= 3 && urlParts[1] === 'guests') {
        const eventId = decodeURIComponent(urlParts[0]);
        const guestName = decodeURIComponent(urlParts[2]);
        console.log('GET guest claims:', { eventId, guestName, urlParts });
        const claims = await getClaimsForEvent(eventId);
        const guestClaims = claims.filter(c => c.eventId === eventId && c.guestName === guestName);
        console.log('Guest claims found:', guestClaims);
        return res.json(guestClaims);
      }

      // GET /api/claims/:eventId
      // In Vercel serverless functions, req.url is '/:eventId'
      if (urlParts.length >= 1) {
        // Only match if not already matched by items or guests routes
        if (urlParts.length === 1 || (urlParts[1] !== 'items' && urlParts[1] !== 'guests')) {
          const eventId = decodeURIComponent(urlParts[0]);
          console.log('GET claims for event:', eventId);
          const claims = await getClaimsForEvent(eventId);
          return res.json(claims);
        }
      }
    }

    if (method === 'POST') {
      // POST /api/claims - Must be root route
      if (isRootClaimsRoute) {
        console.log('POST request body:', req.body);

        const { eventId, itemId, guestName } = req.body;

        if (!eventId || !itemId || !guestName) {
          console.log('Missing required fields');
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get current claims for this event
        const currentClaims = await getClaimsForEvent(eventId);
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
        await saveClaimsForEvent(eventId, currentClaims);
        return res.status(201).json(newClaim);
      }
    }

    if (method === 'PUT') {
      console.log('PUT request - url:', url, 'urlParts:', urlParts);

      // PUT /api/claims - Modify claims (remove or update)
      if (isRootClaimsRoute) {
        console.log('PUT request body:', req.body);

        const { eventId, itemId, action } = req.body;

        if (!eventId) {
          console.log('Event ID required');
          return res.status(400).json({ error: 'Event ID required' });
        }

        const currentClaims = await getClaimsForEvent(eventId);
        console.log('Current claims before action:', currentClaims);

        // Clear all claims for an event
        if (action === 'clear') {
          console.log('Clearing all claims for event:', eventId);
          await saveClaimsForEvent(eventId, []);
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
          await saveClaimsForEvent(eventId, currentClaims);
          return res.json({ success: true });
        }

        console.log('Invalid action:', action);
        return res.status(400).json({ error: 'Invalid action. Use "clear" or "remove"' });
      }
    }
  } catch (error) {
    console.error('Claims API Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  console.log('No route matched:', { method, url, urlParts });
  return res.status(404).json({ error: 'Not found' });
}
