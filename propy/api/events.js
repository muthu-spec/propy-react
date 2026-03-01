// Vercel Serverless Function for Events API
// Uses Vercel Blob for persistent storage
// One JSON file per eventId: potluck-event-{eventId}.json

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

      // Fetch blob content using its URL
      const response = await fetch(blob.url);
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

// Helper to save event data for a specific event
async function saveEventData(eventId, eventData) {
  console.log('Saving event data:', { eventId });

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const prefix = `potluck-event-${eventId}-`;

      // Create new filename with timestamp
      const pathname = `${prefix}.json`;

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
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  console.log('[Events API] Request received:', {
    method: req.method,
    url: req.url,
    path: req.url,
    headers: {
      'user-agent': req.headers['user-agent'],
      'host': req.headers['host'],
      'referer': req.headers['referer'],
      'origin': req.headers['origin']
    }
  });

  console.log('Events API Request:', { method: req.method, url: req.url });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const method = req.method;
  const url = req.url;
  const urlParts = url.split('/').filter(p => p.trim());

  console.log('Parsed URL parts:', urlParts);

  // Vercel serverless function: req.url only contains the path AFTER the function path
  // /api/events → req.url is '/' or ''
  // /api/events/:eventId → req.url is '/:eventId'
  const isRootEventsRoute = url === '/' || url === '' || url === '/api/events' || url === '/api/events/';

  console.log('isRootEventsRoute:', isRootEventsRoute);

  try {
    if (method === 'GET') {
      // GET /api/events - List all events
      if (isRootEventsRoute) {
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

      // GET /api/events/:eventId
      // In Vercel serverless functions, req.url is just '/:eventId'
      if (urlParts.length >= 1) {
        const eventId = decodeURIComponent(urlParts[0]);
        console.log('Getting event for eventId:', eventId);
        const eventData = await getEventData(eventId);
        if (!eventData) {
          console.log('Event not found for eventId:', eventId);
          return res.status(404).json({ error: 'Event not found' });
        }
        return res.json(eventData);
      }
    }

    if (method === 'POST') {
      // POST /api/events - Create a new event
      if (isRootEventsRoute) {
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

        await saveEventData(eventId, eventData);
        return res.status(201).json(eventData);
      }
    }

    if (method === 'PUT') {
      // PUT /api/events - Update an event
      if (isRootEventsRoute) {
        console.log('PUT request body:', req.body);

        const { eventId, title, date, location, drop_time, menu } = req.body;

        if (!eventId) {
          return res.status(400).json({ error: 'Event ID required' });
        }

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

        await saveEventData(eventId, updatedEvent);
        return res.json(updatedEvent);
      }
    }

    if (method === 'DELETE') {
      // DELETE /api/events - Delete an event
      if (isRootEventsRoute) {
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

        return res.json({ success: true });
      }
    }
  } catch (error) {
    console.error('Events API Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  console.log('No route matched:', { method, url, urlParts });
  return res.status(404).json({ error: 'Not found' });
}
