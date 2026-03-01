// Vercel Serverless Function for Events API - Dynamic Route (/api/events/:eventId)
// Uses Vercel Blob for persistent storage

import { put, list, del } from '@vercel/blob';

// In-memory fallback for local development
if (!globalThis.inMemoryEvents) {
  globalThis.inMemoryEvents = {};
}

// Helper to get event data for a specific event
async function getEventData(eventId) {
  console.log('Getting event data for eventId:', eventId);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const prefix = `potluck-event-${eventId}-`;

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
        return null;
      }

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      console.log('Parsed event data:', data);
      return data;
    } else {
      console.log('No blobs found for eventId:', eventId);
    }
  } else {
    console.log('BLOB_READ_WRITE_TOKEN not set');
  }

  // Fallback to in-memory storage (for local development)
  console.log('Checking in-memory storage for:', eventId);
  const inMemoryEvent = globalThis.inMemoryEvents[eventId];
  if (inMemoryEvent) {
    console.log('Found event in in-memory storage:', eventId);
    return inMemoryEvent;
  }

  console.log('Event not found in in-memory storage:', eventId);
  return null;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  console.log('[Events API Dynamic] Request received:', {
    method: req.method,
    url: req.url,
    eventId: req.query.eventId,
  });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const eventId = req.query.eventId;

  if (!eventId) {
    return res.status(400).json({ error: 'Event ID required' });
  }

  const method = req.method;

  try {
    if (method === 'GET') {
      // GET /api/events/:eventId - Get a specific event
      console.log('Getting event for eventId:', eventId);
      const eventData = await getEventData(eventId);
      if (!eventData) {
        console.log('Event not found for eventId:', eventId);
        return res.status(404).json({ error: 'Event not found' });
      }
      return res.json(eventData);
    }

    if (method === 'PUT') {
      // PUT /api/events/:eventId - Update a specific event
      console.log('PUT request body:', req.body);

      const { title, date, location, drop_time, menu } = req.body;

      const existingEvent = await getEventData(eventId);
      if (!existingEvent) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const updatedEvent = {
        ...existingEvent,
        title: title || existingEvent.title,
        date: date || existingEvent.date,
        location: location || existingEvent.location,
        drop_time: drop_time || existingEvent.drop_time,
        menu: menu !== undefined ? menu : existingEvent.menu,
        updatedAt: new Date().toISOString(),
      };

      console.log('About to save updated event data:', updatedEvent);

      // Save event to blob
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          const token = process.env.BLOB_READ_WRITE_TOKEN;
          const pathname = `potluck-event-${eventId}-.json`;

          await put(pathname, JSON.stringify(updatedEvent), {
            token,
            contentType: 'application/json',
            access: 'public',
          });

          console.log('Event updated successfully');
        } catch (error) {
          console.error('Failed to update event to blob:', error);
          throw new Error(`Failed to update event to blob storage: ${error.message}`);
        }
      } else {
        console.log('BLOB_READ_WRITE_TOKEN not set, using in-memory storage');
      }

      // Always update in-memory fallback
      globalThis.inMemoryEvents[eventId] = updatedEvent;

      return res.json(updatedEvent);
    }

    if (method === 'DELETE') {
      // DELETE /api/events/:eventId - Delete a specific event
      console.log('Deleting event:', eventId);

      // Delete all blob files with event prefix (handles GUID suffix)
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const prefix = `potluck-event-${eventId}-`;

      if (token) {
        console.log('Listing blobs to delete with prefix:', prefix);

        const { blobs } = await list({ prefix, token });

        console.log('Found blobs to delete:', blobs.length);

        // Delete all matching files
        for (const blob of blobs) {
          console.log('Deleting blob:', blob.pathname);
          await del(blob.pathname, { token });
        }
      }

      // Clear from in-memory storage
      delete globalThis.inMemoryEvents[eventId];

      return res.json({ success: true });
    }
  } catch (error) {
    console.error('Events API Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  console.log('No route matched:', { method });
  return res.status(405).json({ error: 'Method not allowed' });
}
