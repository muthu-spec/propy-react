// Vercel Serverless Function for Claims API - Nested Route (/api/claims/:eventId/items/:itemId)
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
  const itemId = req.query.itemId;

  if (!eventId || !itemId) {
    return res.status(400).json({ error: 'Event ID and item ID required' });
  }

  console.log('[Claims API Nested - Items] Request received:', {
    method: req.method,
    url: req.url,
    eventId,
    itemId,
  });

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
    res.status(200).end();
    return;
  }

  const method = req.method;

  try {
    if (method === 'GET') {
      // GET /api/claims/:eventId/items/:itemId - Get claim by item
      console.log('GET item claim:', { eventId, itemId });

      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('event_id', eventId)
        .eq('item_id', itemId)
        .maybeSingle();

      if (error) {
        console.error('Failed to get item claim:', error);
        return res.status(500).json({ error: 'Failed to get item claim', details: error.message });
      }

      console.log('Item claim:', data);
      return res.json({ claimedBy: data?.guest_name || null });
    }

    if (method === 'DELETE') {
      // DELETE /api/claims/:eventId/items/:itemId - Delete claim by item
      console.log('DELETE item claim:', { eventId, itemId });

      const { error } = await supabase
        .from('claims')
        .delete()
        .eq('event_id', eventId)
        .eq('item_id', itemId);

      if (error) {
        console.error('Failed to delete item claim:', error);
        return res.status(404).json({ error: 'No claim found for this item', details: error.message });
      }

      console.log('Item claim deleted successfully');
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
