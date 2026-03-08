// Vercel Serverless Function for Events API - Root Route (/api/events)
// Uses Supabase PostgreSQL for persistent storage

import { supabase } from './supabase.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');

  console.log('[Events API Root] Request received:', {
    method: req.method,
    url: req.url,
  });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const method = req.method;

  try {
    if (method === 'GET') {
      // GET /api/events - List all events
      console.log('Listing all events');

      const { data, error } = await supabase
        .from('events')
        .select('id, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to list events:', error);
        return res.status(500).json({ error: 'Failed to list events', details: error.message });
      }

      console.log('All events:', data);
      return res.json(data.map(event => ({
        eventId: event.id,
        uploadedAt: event.created_at,
      })));
    }

    if (method === 'POST') {
      // POST /api/events - Create a new event
      console.log('POST request body:', req.body);

      const { eventId, title, date, location, drop_time, menu, event_type, rsvp_deadline, phone } = req.body;

      if (!eventId || !title || !date || !location) {
        console.log('Missing required fields');
        return res.status(400).json({ error: 'Missing required fields: eventId, title, date, location' });
      }

      // Validate event_type
      if (event_type && !['potluck', 'birthday'].includes(event_type)) {
        console.log('Invalid event_type:', event_type);
        return res.status(400).json({ error: 'Invalid event_type. Must be potluck or birthday' });
      }

      // Validate rsvp_deadline is before event date
      if (rsvp_deadline) {
        const eventDate = new Date(date);
        const rsvpDeadline = new Date(rsvp_deadline);
        if (rsvpDeadline >= eventDate) {
          console.log('RSVP deadline must be before event date');
          return res.status(400).json({ error: 'RSVP deadline must be before the event date' });
        }
      }

      const eventData = {
        id: eventId,
        title,
        date,
        location,
        drop_time: drop_time || null,
        menu: menu || [],
        event_type: event_type || 'potluck',
        rsvp_deadline: rsvp_deadline || null,
        phone: phone || null,
        created_at: new Date().toISOString(),
      };

      console.log('About to save event data:', eventData);

      const { data, error } = await supabase
        .from('events')
        .upsert(eventData)
        .select();

      if (error) {
        console.error('Failed to save event:', error);
        return res.status(500).json({ error: 'Failed to save event', details: error.message });
      }

      console.log('Event saved successfully:', data);
      return res.status(201).json(data);
    }

    if (method === 'PUT') {
      // PUT /api/events - Update an event
      console.log('PUT request body:', req.body);

      const { eventId, title, date, location, drop_time, menu, event_type, rsvp_deadline } = req.body;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID required' });
      }

      // Get existing event
      const { data: existingEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (fetchError || !existingEvent) {
        console.error('Failed to fetch event:', fetchError);
        return res.status(404).json({ error: 'Event not found' });
      }

      // Validate event_type if being changed
      if (event_type && !['potluck', 'birthday'].includes(event_type)) {
        console.log('Invalid event_type:', event_type);
        return res.status(400).json({ error: 'Invalid event_type. Must be potluck or birthday' });
      }

      // Validate rsvp_deadline if provided
      if (rsvp_deadline) {
        const eventDate = new Date(date || existingEvent.date);
        const rsvpDeadline = new Date(rsvp_deadline);
        if (rsvpDeadline >= eventDate) {
          console.log('RSVP deadline must be before event date');
          return res.status(400).json({ error: 'RSVP deadline must be before the event date' });
        }
      }

      const updatedEvent = {
        ...existingEvent,
        title: title || existingEvent.title,
        date: date || existingEvent.date,
        location: location || existingEvent.location,
        drop_time: drop_time !== undefined ? drop_time : existingEvent.drop_time,
        menu: menu !== undefined ? menu : existingEvent.menu,
        event_type: event_type || existingEvent.event_type,
        rsvp_deadline: rsvp_deadline !== undefined ? rsvp_deadline : existingEvent.rsvp_deadline,
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
          event_type: updatedEvent.event_type,
          rsvp_deadline: updatedEvent.rsvp_deadline,
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
      // DELETE /api/events - Delete an event
      console.log('DELETE request body:', req.body);

      const { eventId } = req.body;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID required' });
      }

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
  return res.status(404).json({ error: 'Not found' });
}
