// Vercel Serverless Function for Claims API - Nested Route (/api/claims/:eventId/guests/:guestName)
// Uses Supabase PostgreSQL for persistent storage

import { supabase } from '../../../supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  // Disable caching for real-time claims data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  const eventId = req.query.eventId;
  const guestName = req.query.guestName;

  if (!eventId || !guestName) {
    return res.status(400).json({ error: 'Event ID and guest name required' });
  }

  console.log('[Claims API Nested - Guests] Request received:', {
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
      // GET /api/claims/:eventId/guests/:guestName - Get claims by guest
      console.log('GET guest claims:', { eventId, guestName });

      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('event_id', eventId)
        .eq('guest_name', guestName)
        .order('claim_time', { ascending: false });

      if (error) {
        console.error('Failed to get guest claims:', error);
        return res.status(500).json({ error: 'Failed to get guest claims', details: error.message });
      }

      console.log('Guest claims found:', data);
      return res.json(data || []);
    }

    if (method === 'DELETE') {
      // DELETE /api/claims/:eventId/guests/:guestName - Delete claims by guest
      console.log('DELETE guest claims:', { eventId, guestName });

      const { error } = await supabase
        .from('claims')
        .delete()
        .eq('event_id', eventId)
        .eq('guest_name', guestName);

      if (error) {
        console.error('Failed to delete guest claims:', error);
        return res.status(500).json({ error: 'Failed to delete guest claims', details: error.message });
      }

      console.log('Guest claims deleted successfully');
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
