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
      throw new Error(`Failed to fetch events (${response.status}: ${response.statusText})`);
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
    const url = `${API_BASE_URL}/events`;
    console.log('Creating event:', { url, eventData });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });

    console.log('Response status:', response.status, response.statusText);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      // Clone response to allow multiple reads
      let errorMessage = 'Failed to create event';
      try {
        // Clone the response first
        const clonedResponse = response.clone();
        const errorData = await clonedResponse.json();
        errorMessage = errorData.error || errorMessage;
        console.error('Error response JSON:', errorData);
      } catch {
        // Clone the response first
        const clonedResponse = response.clone();
        const errorText = await clonedResponse.text();
        console.error('Non-JSON error response:', errorText);
        errorMessage = `Failed to create event (${response.status}: ${response.statusText})`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('Event created successfully:', result);
    return result;
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
      // Clone response to allow multiple reads
      let errorMessage = 'Failed to update event';
      try {
        const clonedResponse = response.clone();
        const errorData = await clonedResponse.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        const clonedResponse = response.clone();
        const errorText = await clonedResponse.text();
        console.error('Non-JSON error response:', errorText);
        errorMessage = `Failed to update event (${response.status}: ${response.statusText})`;
      }
      throw new Error(errorMessage);
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
      throw new Error(`Failed to delete event (${response.status}: ${response.statusText})`);
    }

    return response.json();
  },
};

export default eventsApi;
