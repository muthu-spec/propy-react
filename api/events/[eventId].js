// Vercel Serverless Function for Events API - Dynamic Route (/api/events/:eventId)
// Uses Supabase PostgreSQL for persistent storage

import { supabase } from '../supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  console.log('[Events API Dynamic] Request received:', {
    method: req.method,
    url: req.url,
    eventId: req.query.eventId,
  });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const eventId = req.query.eventId;

  if (!eventId) {
    return res.status(400).json({ error: 'Event ID required' });
  }

  const method = req.method;

  try {
    if (method === 'GET') {
      // GET /api/events/:eventId - Get a specific event
      console.log('Getting event for eventId:', eventId);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error || !data) {
        console.log('Event not found for eventId:', eventId);
        return res.status(404).json({ error: 'Event not found' });
      }
      console.log('Event found:', data);
      return res.json(data);
    }

    if (method === 'PUT') {
      // PUT /api/events/:eventId - Update a specific event
      console.log('PUT request body:', req.body);

      const { title, date, location, drop_time, menu } = req.body;

      // Get existing event
      const { data: existingEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (fetchError || !existingEvent) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const updatedEvent = {
        ...existingEvent,
        title: title || existingEvent.title,
        date: date || existingEvent.date,
        location: location || existingEvent.location,
        drop_time: drop_time || existingEvent.drop_time,
        menu: menu !== undefined ? menu : existingEvent.menu,
        updated_at: new Date().toISOString(),
      };

      console.log('About to save updated event data:', updatedEvent);

      const { data, error } = await supabase
        .from('events')
        .update({
          title: updatedEvent.title,
          date: updatedEvent.date,
          location: updatedEvent.location,
          drop_time: updatedEvent.drop_time,
          menu: updatedEvent.menu,
          updated_at: updatedEvent.updated_at,
        })
        .eq('id', eventId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update event:', error);
        return res.status(500).json({ error: 'Failed to update event', details: error.message });
      }

      console.log('Event updated successfully:', data);
      return res.json(data);
    }

    if (method === 'DELETE') {
      // DELETE /api/events/:eventId - Delete a specific event
      console.log('Deleting event:', eventId);

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) {
        console.error('Failed to delete event:', error);
        return res.status(500).json({ error: 'Failed to delete event', details: error.message });
      }

      console.log('Event deleted successfully:', eventId);
      return res.json({ success: true });
    }
  } catch (error) {
    console.error('Events API Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }

  console.log('No route matched:', { method });
  return res.status(405).json({ error: 'Method not allowed' });
}
