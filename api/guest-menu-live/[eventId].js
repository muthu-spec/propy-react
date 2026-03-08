// Vercel Serverless Function for Guest Menu Live API - Dynamic Route (/api/guest-menu-live/:eventId)
// Uses Supabase PostgreSQL for persistent storage

import { supabase } from '../supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  // Disable caching for real-time menu live data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  const eventId = req.query.eventId;

  if (!eventId) {
    return res.status(400).json({ error: 'Event ID required' });
  }

  console.log('[Guest Menu Live API Dynamic] Request received:', {
    method: req.method,
    url: req.url,
    eventId,
    envCheck: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
    },
  });

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
    res.status(200).end();
    return;
  }

  const method = req.method;

  try {
    // Check if Supabase is properly initialized
    if (!supabase) {
      console.error('Supabase client not initialized');
      return res.status(500).json({ error: 'Database connection failed - check environment variables' });
    }

    if (method === 'GET') {
      // GET /api/guest-menu-live/:eventId - Get menu live status for an event
      console.log('GET menu live status for event:', eventId);

      const { data, error } = await supabase
        .from('guest_menu_live')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();

      if (error) {
        console.error('Failed to get menu live status:', error);
        return res.status(500).json({ error: 'Failed to get menu live status', details: error.message });
      }

      if (!data) {
        console.log('Menu live status not found for event:', eventId);
        return res.json({ is_live: false });
      }

      console.log('Menu live status:', data);
      return res.json({ is_live: data.is_live });
    }

    if (method === 'POST') {
      // POST /api/guest-menu-live/:eventId - Create or update menu live status
      console.log('POST request body:', req.body);

      // Parse JSON body if not already parsed
      let body = req.body;
      if (typeof req.body === 'string') {
        try {
          body = JSON.parse(req.body);
        } catch (e) {
          console.error('Failed to parse request body:', e);
          return res.status(400).json({ error: 'Invalid JSON in request body' });
        }
      }

      const { isLive } = body;

      if (typeof isLive !== 'boolean') {
        console.log('Invalid isLive value');
        return res.status(400).json({ error: 'Invalid isLive value. Must be true or false' });
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
      // DELETE /api/guest-menu-live/:eventId - Delete menu live status for an event
      console.log('DELETE menu live status for event:', eventId);

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
