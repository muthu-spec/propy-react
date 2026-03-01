// Vercel Serverless Function for Events API - Root Route (/api/events)
// Uses Vercel Blob for persistent storage

import { put, list, del } from '@vercel/blob';

// In-memory fallback for local development
if (!globalThis.inMemoryEvents) {
  globalThis.inMemoryEvents = {};
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  console.log('[Events API Root] Request received:', {
    method: req.method,
    url: req.url,
  });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const method = req.method;

  try {
    if (method === 'GET') {
      // GET /api/events - List all events
      console.log('Listing all events');

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        const { blobs } = await list({
          prefix: 'potluck-event-',
          token,
        });
        console.log('All events blobs:', blobs.length);
        // Handle GUID in filename: potluck-event-{eventId}-{guid}.json
        return res.json(blobs.map(b => {
          const filename = b.pathname.replace('potluck-event-', '').replace('.json', '');
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
      console.log('No BLOB_READ_WRITE_TOKEN, returning empty array');
      return res.json([]);
    }

    if (method === 'POST') {
      // POST /api/events - Create a new event
      console.log('POST request body:', req.body);

      const { eventId, title, date, location, drop_time, menu, phone } = req.body;

      if (!eventId || !title || !date || !location) {
        console.log('Missing required fields');
        return res.status(400).json({ error: 'Missing required fields: eventId, title, date, location' });
      }

      const eventData = {
        eventId,
        title,
        date,
        location,
        drop_time: drop_time || new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        menu: menu || [],
        phone: phone || null,
        createdAt: new Date().toISOString(),
      };

      console.log('About to save event data:', eventData);

      // Save event to blob
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          const token = process.env.BLOB_READ_WRITE_TOKEN;
          const pathname = `potluck-event-${eventId}-.json`;

          console.log('Saving event to:', pathname);

          await put(pathname, JSON.stringify(eventData), {
            token,
            contentType: 'application/json',
            access: 'public',
          });

          console.log('Event saved successfully to:', pathname);
        } catch (error) {
          console.error('Failed to save event to blob:', error);
          throw new Error(`Failed to save event to blob storage: ${error.message}`);
        }
      } else {
        console.log('BLOB_READ_WRITE_TOKEN not set, using in-memory storage');
      }

      // Always update in-memory fallback (for local development)
      globalThis.inMemoryEvents[eventId] = eventData;
      console.log('Event saved to in-memory storage for:', eventId);

      return res.status(201).json(eventData);
    }

    if (method === 'PUT') {
      // PUT /api/events - Update an event
      console.log('PUT request body:', req.body);

      const { eventId, title, date, location, drop_time, menu } = req.body;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID required' });
      }

      // Get existing event data
      let existingEvent = globalThis.inMemoryEvents[eventId];
      if (!existingEvent && process.env.BLOB_READ_WRITE_TOKEN) {
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        const prefix = `potluck-event-${eventId}-`;
        const { blobs } = await list({ prefix, token });

        if (blobs.length > 0) {
          const response = await fetch(blobs[0].url);
          const text = await response.text();
          existingEvent = text ? JSON.parse(text) : null;
        }
      }

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
      // DELETE /api/events - Delete an event
      console.log('DELETE request body:', req.body);

      const { eventId } = req.body;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID required' });
      }

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
  return res.status(404).json({ error: 'Not found' });
}
