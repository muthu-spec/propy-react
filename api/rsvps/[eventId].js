// Vercel Serverless Function for RSVPs API - Dynamic Route (/api/rsvps/:eventId)
// Uses Supabase PostgreSQL for persistent storage

import { supabase } from '../../supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  // Disable caching for real-time RSVP data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  const eventId = req.query.eventId;

  if (!eventId) {
    return res.status(400).json({ error: 'Event ID required' });
  }

  console.log('[RSVPs API Dynamic] Request received:', {
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
      // GET /api/rsvps/:eventId - Get all RSVPs for an event
      console.log('GET RSVPs for event:', eventId);

      const { data, error } = await supabase
        .from('rsvps')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to get RSVPs:', error);
        return res.status(500).json({ error: 'Failed to get RSVPs', details: error.message });
      }

      return res.json(data || []);
    }

    if (method === 'PUT') {
      // PUT /api/rsvps/:eventId - Modify RSVPs for an event
      console.log('PUT request body:', req.body);

      const { action, guestName, attending, adults, kids } = req.body;

      if (!action) {
        console.log('Action required');
        return res.status(400).json({ error: 'Action required' });
      }

      // Clear all RSVPs for an event
      if (action === 'clear') {
        console.log('Clearing all RSVPs for event:', eventId);

        const { error } = await supabase
          .from('rsvps')
          .delete()
          .eq('event_id', eventId);

        if (error) {
          console.error('Failed to clear RSVPs:', error);
          return res.status(500).json({ error: 'Failed to clear RSVPs', details: error.message });
        }

        console.log('RSVPs cleared successfully');
        return res.json({ success: true });
      }

      // Update a specific RSVP
      if (action === 'update' && guestName) {
        console.log('Updating RSVP:', { eventId, guestName });

        if (!attending) {
          console.log('Attending status required');
          return res.status(400).json({ error: 'Attending status required' });
        }

        const { error } = await supabase
          .from('rsvps')
          .update({
            attending,
            adults: adults !== undefined ? adults : undefined,
            kids: kids !== undefined ? kids : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('event_id', eventId)
          .eq('guest_name', guestName);

        if (error) {
          console.error('Failed to update RSVP:', error);
          return res.status(404).json({ error: 'RSVP not found', details: error.message });
        }

        console.log('RSVP updated successfully');
        return res.json({ success: true });
      }

      console.log('Invalid action:', action);
      return res.status(400).json({ error: 'Invalid action. Use "clear" or "update"' });
    }

    if (method === 'DELETE') {
      // DELETE /api/rsvps/:eventId - Delete all RSVPs for an event
      console.log('Deleting all RSVPs for event:', eventId);

      const { error } = await supabase
        .from('rsvps')
        .delete()
        .eq('event_id', eventId);

      if (error) {
        console.error('Failed to delete RSVPs:', error);
        return res.status(500).json({ error: 'Failed to delete RSVPs', details: error.message });
      }

      console.log('All RSVPs deleted successfully');
      return res.json({ success: true });
    }
  } catch (error) {
    console.error('RSVPs API Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  console.log('No route matched:', { method });
  return res.status(405).json({ error: 'Method not allowed' });
}
