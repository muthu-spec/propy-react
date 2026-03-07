// Vercel Serverless Function for Guest Menu Live API - Root Route (/api/guest-menu-live)
// Uses Supabase PostgreSQL for persistent storage

import { supabase } from './supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  // Disable caching for real-time menu live data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  console.log('[Guest Menu Live API Root] Request received:', {
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
      // GET /api/guest-menu-live - Get all menu live status
      console.log('GET all menu live status');

      const { data, error } = await supabase
        .from('guest_menu_live')
        .select('*');

      if (error) {
        console.error('Failed to get menu live status:', error);
        return res.status(500).json({ error: 'Failed to get menu live status', details: error.message });
      }

      return res.json(data || []);
    }

    if (method === 'POST') {
      // POST /api/guest-menu-live - Create or update menu live status
      console.log('POST request body:', req.body);

      const { eventId, isLive } = req.body;

      if (!eventId || typeof isLive !== 'boolean') {
        console.log('Missing required fields');
        return res.status(400).json({ error: 'Missing required fields: eventId, isLive' });
      }

      // Check if menu live status already exists
      const { data: existingStatus, error: checkError } = await supabase
        .from('guest_menu_live')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();

      if (checkError) {
        console.error('Failed to check existing menu live status:', checkError);
        return res.status(500).json({ error: 'Failed to check existing menu live status', details: checkError.message });
      }

      if (existingStatus) {
        // Update existing status
        console.log('Updating menu live status:', { eventId, isLive });

        const { data, error } = await supabase
          .from('guest_menu_live')
          .update({ is_live: isLive })
          .eq('event_id', eventId)
          .select()
          .single();

        if (error) {
          console.error('Failed to update menu live status:', error);
          return res.status(500).json({ error: 'Failed to update menu live status', details: error.message });
        }

        console.log('Menu live status updated successfully:', data);
        return res.json(data);
      } else {
        // Create new status
        console.log('Creating new menu live status:', { eventId, isLive });

        const { data, error } = await supabase
          .from('guest_menu_live')
          .insert({
            event_id: eventId,
            is_live: isLive,
          })
          .select()
          .single();

        if (error) {
          console.error('Failed to create menu live status:', error);
          return res.status(500).json({ error: 'Failed to create menu live status', details: error.message });
        }

        console.log('Menu live status created successfully:', data);
        return res.json(data);
      }
    }

    if (method === 'DELETE') {
      // DELETE /api/guest-menu-live - Delete menu live status for an event
      console.log('DELETE menu live status for event:', req.query.eventId);

      const eventId = req.query.eventId;

      if (!eventId) {
        console.log('Event ID required');
        return res.status(400).json({ error: 'Event ID required' });
      }

      const { error } = await supabase
        .from('guest_menu_live')
        .delete()
        .eq('event_id', eventId);

      if (error) {
        console.error('Failed to delete menu live status:', error);
        return res.status(500).json({ error: 'Failed to delete menu live status', details: error.message });
      }

      console.log('Menu live status deleted successfully');
      return res.json({ success: true });
    }
  } catch (error) {
    console.error('Guest Menu Live API Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  console.log('No route matched:', { method });
  return res.status(405).json({ error: 'Method not allowed' });
}
