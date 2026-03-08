// Vercel Serverless Function for Claims API - Dynamic Route (/api/claims/:eventId)
// Uses Supabase PostgreSQL for persistent storage

import { supabase } from '../supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  // Disable caching for real-time claims data
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
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('event_id', eventId)
        .order('claim_time', { ascending: false });

      if (error) {
        console.error('Failed to get claims:', error);
        return res.status(500).json({ error: 'Failed to get claims', details: error.message });
      }

      return res.json(data || []);
    }

    if (method === 'PUT') {
      // PUT /api/claims/:eventId - Modify claims for an event
      console.log('PUT request body:', req.body);

      const { action, itemId } = req.body;

      const currentClaimsResult = await supabase
        .from('claims')
        .select('*')
        .eq('event_id', eventId)
        .order('claim_time', { ascending: false });

      const currentClaims = currentClaimsResult.data || [];

      console.log('Current claims before action:', currentClaims);

      // Clear all claims for an event
      if (action === 'clear') {
        console.log('Clearing all claims for event:', eventId);

        const { error } = await supabase
          .from('claims')
          .delete()
          .eq('event_id', eventId);

        if (error) {
          console.error('Failed to clear claims:', error);
          return res.status(500).json({ error: 'Failed to clear claims', details: error.message });
        }

        console.log('Claims cleared successfully');
        return res.json({ success: true });
      }

      // Remove a specific claim
      if (action === 'remove' && itemId) {
        console.log('Removing claim:', { eventId, itemId });

        const { error } = await supabase
          .from('claims')
          .delete()
          .eq('event_id', eventId)
          .eq('item_id', itemId);

        if (error) {
          console.error('Failed to remove claim:', error);
          return res.status(404).json({ error: 'Claim not found', details: error.message });
        }

        console.log('Claim removed successfully');
        return res.json({ success: true });
      }

      console.log('Invalid action:', action);
      return res.status(400).json({ error: 'Invalid action. Use "clear" or "remove"' });
    }

    if (method === 'DELETE') {
      // DELETE /api/claims/:eventId - Delete all claims for an event
      console.log('Deleting all claims for event:', eventId);

      const { error } = await supabase
        .from('claims')
        .delete()
        .eq('event_id', eventId);

      if (error) {
        console.error('Failed to delete claims:', error);
        return res.status(500).json({ error: 'Failed to delete claims', details: error.message });
      }

      console.log('All claims deleted successfully');
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
