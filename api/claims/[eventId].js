// Vercel Serverless Function for Claims API - Dynamic Route (/api/claims/:eventId)
// Uses Vercel Blob for persistent storage

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
      console.log('Blob URL:', blob.url);
      console.log('Blob downloadUrl:', blob.downloadUrl);

      // Try different URL options
      const downloadUrl = blob.downloadUrl || blob.url;
      console.log('Fetching blob from:', downloadUrl);

      const response = await fetch(downloadUrl);
      console.log('Fetch response status:', response.status);
      console.log('Fetch response ok:', response.ok);

      if (!response.ok) {
        console.error('Failed to fetch blob:', response.status, response.statusText);
        return [];
      }

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

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  // Disable caching for real-time claims data (critical to prevent duplicate claims)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  const eventId = req.query.eventId;

  if (!eventId) {
    return res.status(400).json({ error: 'Event ID required' });
  }

  console.log('[Claims API Dynamic] Request received:', {
    method: req.method,
    url: req.url,
    eventId,
  });

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
    res.status(200).end();
    return;
  }

  const method = req.method;

  try {
    if (method === 'GET') {
      // GET /api/claims/:eventId - Get all claims for an event
      console.log('GET claims for event:', eventId);
      const claims = await getClaimsForEvent(eventId);
      return res.json(claims);
    }

    if (method === 'PUT') {
      // PUT /api/claims/:eventId - Modify claims for an event
      console.log('PUT request body:', req.body);

      const { action, itemId } = req.body;

      const currentClaims = await getClaimsForEvent(eventId);
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

    if (method === 'DELETE') {
      // DELETE /api/claims/:eventId - Delete all claims for an event
      console.log('Deleting all claims for event:', eventId);

      // Delete all blob files for this event
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const prefix = `potluck-claims-${eventId}-`;

      if (token) {
        const { blobs } = await list({ prefix, token });
        for (const blob of blobs) {
          await del(blob.pathname, { token });
        }
      }

      // Clear from in-memory storage
      globalThis.inMemoryClaims[eventId] = [];

      return res.json({ success: true });
    }
  } catch (error) {
    console.error('Claims API Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  console.log('No route matched:', { method });
  return res.status(405).json({ error: 'Method not allowed' });
}
