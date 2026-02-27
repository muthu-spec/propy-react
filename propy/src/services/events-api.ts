// Events API Service for Event Data Management
// Uses Vercel serverless functions with Blob storage

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface MenuItem {
  id: string;
  label: string;
  claimedBy?: string;
}

export interface EventData {
  eventId: string;
  title: string;
  date: string;
  location: string;
  drop_time: string;
  menu: MenuItem[];
  phone?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const eventsApi = {
  // Get all events
  async getAllEvents(): Promise<{ eventId: string; uploadedAt: string; size: number }[]> {
    const response = await fetch(`${API_BASE_URL}/events`);
    if (!response.ok) {
      throw new Error('Failed to fetch events');
    }
    return response.json();
  },

  // Get event data by ID
  async getEventById(eventId: string): Promise<EventData | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch event');
      }
      return response.json();
    } catch (error) {
      console.error('Failed to fetch event:', error);
      return null;
    }
  },

  // Create a new event
  async createEvent(eventData: EventData): Promise<EventData> {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create event');
    }

    return response.json();
  },

  // Update an existing event
  async updateEvent(eventId: string, updates: Partial<EventData>): Promise<EventData> {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventId,
        ...updates,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update event');
    }

    return response.json();
  },

  // Delete an event
  async deleteEvent(eventId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventId }),
    });

    if (!response.ok) {
      throw new Error('Failed to delete event');
    }

    return response.json();
  },
};

export default eventsApi;
