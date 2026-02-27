// Vercel Serverless Function for Events API
// Uses Vercel Blob for persistent storage
// One JSON file per eventId: potluck-event-{eventId}.json

import { put, get, list, del } from '@vercel/blob';

// Helper to get event data for a specific event
async function getEventData(eventId) {
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const pathname = `potluck-event-${eventId}.json`;

      const blob = await get(pathname, { access: 'public', token });

      if (blob) {
        const text = await blob.stream.text();
        return text ? JSON.parse(text) : null;
      }
    }
  } catch (error) {
    console.error('Failed to get event from Blob:', error);
  }
  return null;
}

// Helper to save event data for a specific event
async function saveEventData(eventId, eventData) {
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const pathname = `potluck-event-${eventId}.json`;

      await put(pathname, JSON.stringify(eventData), {
        token,
        contentType: 'application/json',
        access: 'public',
        allowOverwrite: true,
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

  const isRootEventsRoute = url === '/api/events' || url === '/api/events/';

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
          return res.json(blobs.map(b => ({
            eventId: b.pathname.replace('potluck-event-', '').replace('.json', ''),
            uploadedAt: b.uploadedAt,
            size: b.size,
          })));
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

        // Use del function to delete the blob file
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        const pathname = `potluck-event-${eventId}.json`;

        if (token) {
          await del(pathname, { token });
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
