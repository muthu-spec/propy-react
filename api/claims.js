// Vercel Serverless Function for Claims API - Root Route (/api/claims)
// Uses Supabase PostgreSQL for persistent storage

import { supabase } from './supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  // Disable caching for real-time claims data (critical to prevent duplicate claims)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  console.log('[Claims API Root] Request received:', {
    method: req.method,
    url: req.url,
  });

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
    res.status(200).end();
    return;
  }

  const method = req.method;

  try {
    if (method === 'GET') {
      // GET /api/claims - List all event files
      console.log('Listing all claims events');

      // Get unique event IDs from claims
      const { data, error } = await supabase
        .from('claims')
        .select('event_id');

      if (error) {
        console.error('Failed to list claims:', error);
        return res.status(500).json({ error: 'Failed to list claims', details: error.message });
      }

      // Get event details for each unique event ID
      const eventIds = [...new Set(data.map(c => c.event_id))];

      return res.json(eventIds.map(eventId => ({
        eventId,
      })));
    }

    if (method === 'POST') {
      // POST /api/claims - Create a new claim
      console.log('POST request body:', req.body);

      const { eventId, itemId, guestName } = req.body;

      if (!eventId || !itemId || !guestName) {
        console.log('Missing required fields');
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if item is already claimed
      const { data: existingClaims, error: checkError } = await supabase
        .from('claims')
        .select('*')
        .eq('event_id', eventId)
        .eq('item_id', itemId)
        .maybeSingle();

      if (checkError) {
        console.error('Failed to check existing claim:', checkError);
        return res.status(500).json({ error: 'Failed to check existing claim', details: checkError.message });
      }

      if (existingClaims) {
        console.log('Item already claimed by:', existingClaims.guest_name);
        return res.status(409).json({ error: 'Item already claimed', claimedBy: existingClaims.guest_name });
      }

      // Check if guest already claimed an item
      const { data: guestExistingClaim, error: guestCheckError } = await supabase
        .from('claims')
        .select('*')
        .eq('event_id', eventId)
        .eq('guest_name', guestName)
        .maybeSingle();

      if (guestCheckError) {
        console.error('Failed to check guest existing claim:', guestCheckError);
        return res.status(500).json({ error: 'Failed to check guest claim', details: guestCheckError.message });
      }

      if (guestExistingClaim) {
        console.log('Guest already claimed item:', guestExistingClaim.item_id);
        return res.status(409).json({ error: 'Guest already claimed an item', itemId: guestExistingClaim.item_id });
      }

      const newClaim = {
        event_id: eventId,
        item_id: itemId,
        guest_name: guestName,
        claim_time: new Date().toISOString()
      };

      console.log('Creating new claim:', newClaim);

      const { data, error } = await supabase
        .from('claims')
        .insert(newClaim)
        .select()
        .single();

      if (error) {
        console.error('Failed to create claim:', error);
        // Check for constraint violation (item already claimed)
        if (error.code === '23505') {
          console.log('Item already claimed (constraint violation)');
          return res.status(409).json({ error: 'Item already claimed', claimedBy: guestName });
        }
        if (error.code === '23503') {
          console.log('Guest already claimed item (constraint violation)');
          return res.status(409).json({ error: 'Guest already claimed an item', itemId });
        }
        return res.status(500).json({ error: 'Failed to create claim', details: error.message });
      }

      console.log('Claim created successfully:', data);
      return res.status(201).json(data);
    }

    if (method === 'PUT') {
      // PUT /api/claims - Modify claims (remove or update)
      console.log('PUT request body:', req.body);

      const { eventId, itemId, action } = req.body;

      if (!eventId) {
        console.log('Event ID required');
        return res.status(400).json({ error: 'Event ID required' });
      }

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
  } catch (error) {
    console.error('Claims API Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  console.log('No route matched:', { method });
  return res.status(404).json({ error: 'Not found' });
}
