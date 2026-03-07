// Vercel Serverless Function for RSVPs API - Nested Route (/api/rsvps/:eventId/guests/:guestName)
// Uses Supabase PostgreSQL for persistent storage

import { supabase } from '../../../supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  // Disable caching for real-time RSVP data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  const eventId = req.query.eventId;
  const guestName = req.query.guestName;

  if (!eventId || !guestName) {
    return res.status(400).json({ error: 'Event ID and guest name required' });
  }

  console.log('[RSVPs API Nested - Guests] Request received:', {
    method: req.method,
    url: req.url,
    eventId,
    guestName,
  });

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
    res.status(200).end();
    return;
  }

  const method = req.method;

  try {
    if (method === 'GET') {
      // GET /api/rsvps/:eventId/guests/:guestName - Get RSVP for a specific guest
      console.log('GET RSVP for guest:', { eventId, guestName });

      const { data, error } = await supabase
        .from('rsvps')
        .select('*')
        .eq('event_id', eventId)
        .eq('guest_name', guestName)
        .maybeSingle();

      if (error) {
        console.error('Failed to get RSVP:', error);
        return res.status(500).json({ error: 'Failed to get RSVP', details: error.message });
      }

      console.log('RSVP found:', data);
      return res.json(data);
    }

    if (method === 'DELETE') {
      // DELETE /api/rsvps/:eventId/guests/:guestName - Delete RSVP for a specific guest
      console.log('DELETE RSVP for guest:', { eventId, guestName });

      const { error } = await supabase
        .from('rsvps')
        .delete()
        .eq('event_id', eventId)
        .eq('guest_name', guestName);

      if (error) {
        console.error('Failed to delete RSVP:', error);
        return res.status(404).json({ error: 'RSVP not found', details: error.message });
      }

      console.log('RSVP deleted successfully');
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
