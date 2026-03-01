// Vercel Serverless Function for Claims API - Nested Route (/api/claims/:eventId/items/:itemId)
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

      // Fetch blob content using its URL
      const downloadUrl = blob.downloadUrl || blob.url;
      const response = await fetch(downloadUrl);
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

  // Disable caching for real-time claims data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  console.log('[Claims API Nested - Items] Request received:', {
    method: req.method,
    url: req.url,
    eventId: req.query.eventId,
    itemId: req.query.itemId,
  });

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
    res.status(200).end();
    return;
  }

  const eventId = req.query.eventId;
  const itemId = req.query.itemId;

  if (!eventId || !itemId) {
    return res.status(400).json({ error: 'Event ID and item ID required' });
  }

  try {
    if (req.method === 'GET') {
      // GET /api/claims/:eventId/items/:itemId - Get claim by item
      console.log('GET item claim:', { eventId, itemId });

      const claims = await getClaimsForEvent(eventId);
      const claim = claims.find(c => c.eventId === eventId && c.itemId === itemId);
      console.log('Item claim:', claim);
      return res.json({ claimedBy: claim?.guestName || null });
    }

    if (req.method === 'DELETE') {
      // DELETE /api/claims/:eventId/items/:itemId - Delete claim by item
      console.log('DELETE item claim:', { eventId, itemId });

      // Get current claims
      const currentClaims = await getClaimsForEvent(eventId);
      const claimIndex = currentClaims.findIndex(c => c.eventId === eventId && c.itemId === itemId);

      if (claimIndex === -1) {
        return res.status(404).json({ error: 'No claim found for this item' });
      }

      // Remove the claim
      const removedClaim = currentClaims[claimIndex];
      const updatedClaims = [...currentClaims.slice(0, claimIndex), ...currentClaims.slice(claimIndex + 1)];

      // Save updated claims
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          const token = process.env.BLOB_READ_WRITE_TOKEN;
          const pathname = `potluck-claims-${eventId}-${Date.now()}.json`;

          await put(pathname, JSON.stringify(updatedClaims), {
            token,
            contentType: 'application/json',
            access: 'public',
          });

          console.log('Item claim removed successfully');
        } catch (error) {
          console.error('Failed to save claims to blob:', error);
          throw new Error(`Failed to save claims to blob storage: ${error.message}`);
        }
      } else {
        console.log('BLOB_READ_WRITE_TOKEN not set');
      }

      // Update in-memory fallback
      globalThis.inMemoryClaims[eventId] = updatedClaims;

      return res.json({ success: true, removedClaim });
    }
  } catch (error) {
    console.error('Claims API Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  console.log('No route matched:', { method });
  return res.status(405).json({ error: 'Method not allowed' });
}
