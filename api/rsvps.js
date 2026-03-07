// Vercel Serverless Function for RSVPs API - Root Route (/api/rsvps)
// Uses Supabase PostgreSQL for persistent storage

import { supabase } from './supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  // Disable caching for real-time RSVP data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  console.log('[RSVPs API Root] Request received:', {
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
    if (method === 'POST') {
      // POST /api/rsvps - Create or update RSVP
      console.log('POST request body:', req.body);

      const { eventId, guestName, attending, adults, kids } = req.body;

      if (!eventId || !guestName || !attending) {
        console.log('Missing required fields');
        return res.status(400).json({ error: 'Missing required fields: eventId, guestName, attending' });
      }

      // Validate inputs
      if (!['Yes', 'No', 'not-sure'].includes(attending)) {
        console.log('Invalid attending value:', attending);
        return res.status(400).json({ error: 'Invalid attending value. Must be Yes, No, or not-sure' });
      }

      if (typeof adults !== 'number' || adults < 0) {
        return res.status(400).json({ error: 'Invalid adults value' });
      }

      if (typeof kids !== 'number' || kids < 0) {
        return res.status(400).json({ error: 'Invalid kids value' });
      }

      // Check if RSVP already exists
      const { data: existingRSVP, error: checkError } = await supabase
        .from('rsvps')
        .select('*')
        .eq('event_id', eventId)
        .eq('guest_name', guestName)
        .maybeSingle();

      if (checkError) {
        console.error('Failed to check existing RSVP:', checkError);
        return res.status(500).json({ error: 'Failed to check existing RSVP', details: checkError.message });
      }

      const rsvpData = {
        event_id: eventId,
        guest_name: guestName,
        attending,
        adults,
        kids,
      };

      let result;
      if (existingRSVP) {
        // Update existing RSVP
        console.log('Updating existing RSVP:', existingRSVP);
        const { data, error } = await supabase
          .from('rsvps')
          .update({
            attending,
            adults,
            kids,
            updated_at: new Date().toISOString(),
          })
          .eq('event_id', eventId)
          .eq('guest_name', guestName)
          .select()
          .single();

        if (error) {
          console.error('Failed to update RSVP:', error);
          return res.status(500).json({ error: 'Failed to update RSVP', details: error.message });
        }

        result = data;
        console.log('RSVP updated successfully:', result);
      } else {
        // Create new RSVP
        console.log('Creating new RSVP:', rsvpData);
        const { data, error } = await supabase
          .from('rsvps')
          .insert(rsvpData)
          .select()
          .single();

        if (error) {
          console.error('Failed to create RSVP:', error);
          return res.status(500).json({ error: 'Failed to create RSVP', details: error.message });
        }

        result = data;
        console.log('RSVP created successfully:', result);
      }

      return res.status(201).json(result);
    }

    if (method === 'PUT') {
      // PUT /api/rsvps - Clear all RSVPs for an event
      console.log('PUT request body:', req.body);

      const { action, eventId } = req.body;

      if (!eventId) {
        console.log('Event ID required');
        return res.status(400).json({ error: 'Event ID required' });
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

      // Remove a specific RSVP
      if (action === 'remove') {
        const { guestName } = req.body;
        if (!guestName) {
          console.log('Guest name required');
          return res.status(400).json({ error: 'Guest name required' });
        }

        console.log('Removing RSVP:', { eventId, guestName });

        const { error } = await supabase
          .from('rsvps')
          .delete()
          .eq('event_id', eventId)
          .eq('guest_name', guestName);

        if (error) {
          console.error('Failed to remove RSVP:', error);
          return res.status(404).json({ error: 'RSVP not found', details: error.message });
        }

        console.log('RSVP removed successfully');
        return res.json({ success: true });
      }

      console.log('Invalid action:', action);
      return res.status(400).json({ error: 'Invalid action. Use "clear" or "remove"' });
    }
  } catch (error) {
    console.error('RSVPs API Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  console.log('No route matched:', { method });
  return res.status(405).json({ error: 'Method not allowed' });
}
