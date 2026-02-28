// Vercel Serverless Function for Events API
// Uses Vercel Blob for persistent storage
// One JSON file per eventId: potluck-event-{eventId}.json

import { put, list, del } from '@vercel/blob';

// Helper to get event data for a specific event
async function getEventData(eventId) {
  try {
    console.log('getEventData called with eventId:', eventId);
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const prefix = `potluck-event-${eventId}-`;

      console.log('Searching for blobs with prefix:', prefix);

      // List all blobs with the prefix (Vercel appends GUID to filename)
      const { list, get } = await import('@vercel/blob');
      const { blobs } = await list({
        prefix,
        token,
      });

      console.log('Found blobs:', blobs.length, blobs.map(b => b.pathname));

      // Get the first matching blob (most recent)
      if (blobs.length > 0) {
        const blob = await get(blobs[0].pathname, { access: 'public', token });

        console.log('Got blob:', blob.pathname);

        if (blob) {
          const text = await blob.stream.text();
          const data = text ? JSON.parse(text) : null;
          console.log('Parsed event data:', data);
          return data;
        }
      }
    } else {
      console.log('BLOB_READ_WRITE_TOKEN not set');
    }
  } catch (error) {
    console.error('Failed to get event from Blob:', error);
  }
  console.log('Returning null from getEventData');
  return null;
}

// Helper to save event data for a specific event (deletes old files with GUID suffix)
async function saveEventData(eventId, eventData) {
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const prefix = `potluck-event-${eventId}-`;

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

      await put(pathname, JSON.stringify(eventData), {
        token,
        contentType: 'application/json',
        access: 'public',
      });
    }
  } catch (error) {
    console.error('Failed to save event to Blob:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  console.log('Events API Request:', { method: req.method, url: req.url });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const method = req.method;
  const url = req.url;
  const urlParts = url.split('/').filter(p => p.trim());

  console.log('Parsed URL parts:', urlParts);

  const isRootEventsRoute = url === '/api/events' || url === '/api/events/';

  console.log('isRootEventsRoute:', isRootEventsRoute);

  try {
    if (method === 'GET') {
      // GET /api/events - List all events
      if (isRootEventsRoute) {
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const token = process.env.BLOB_READ_WRITE_TOKEN;
          const { blobs } = await list({
            prefix: 'potluck-event-',
            token,
          });
          // Handle GUID in filename: potluck-event-{eventId}-{guid}.json
          return res.json(blobs.map(b => {
            const filename = b.pathname.replace('potluck-event-', '').replace('.json', '');
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
        return res.json([]);
      }

      // GET /api/events/:eventId
      if (urlParts.length >= 3 && urlParts[0] === 'api' && urlParts[1] === 'events') {
        const eventId = decodeURIComponent(urlParts[2]);
        const eventData = await getEventData(eventId);
        if (!eventData) {
          return res.status(404).json({ error: 'Event not found' });
        }
        return res.json(eventData);
      }
    }

    if (method === 'POST') {
      // POST /api/events - Create a new event
      if (isRootEventsRoute) {
        const { eventId, title, date, location, drop_time, menu, phone } = req.body;

        if (!eventId || !title || !date || !location) {
          return res.status(400).json({ error: 'Missing required fields: eventId, title, date, location' });
        }

        const eventData = {
          eventId,
          title,
          date,
          location,
          drop_time: drop_time || new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // Default 3 hours from now
          menu: menu || [],
          phone: phone || null,
          createdAt: new Date().toISOString(),
        };

        await saveEventData(eventId, eventData);
        return res.status(201).json(eventData);
      }
    }

    if (method === 'PUT') {
      // PUT /api/events - Update an event
      if (isRootEventsRoute) {
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

        await saveEventData(eventId, updatedEvent);
        return res.json(updatedEvent);
      }
    }

    if (method === 'DELETE') {
      // DELETE /api/events - Delete an event
      if (isRootEventsRoute) {
        const { eventId } = req.body;

        if (!eventId) {
          return res.status(400).json({ error: 'Event ID required' });
        }

        // Delete all blob files with the event prefix (handles GUID suffix)
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        const prefix = `potluck-event-${eventId}-`;

        if (token) {
          const { list } = await import('@vercel/blob');
          const { blobs } = await list({
            prefix,
            token,
          });

          // Delete all matching files
          for (const blob of blobs) {
            await del(blob.pathname, { token });
          }
        }

        return res.json({ success: true });
      }
    }
  } catch (error) {
    console.error('Events API Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  return res.status(404).json({ error: 'Not found' });
}
