// RSVPs API Service for Guest RSVP Tracking
// Uses Vercel serverless functions with Supabase storage

// For Vercel deployment, VITE_API_URL is empty (uses /api prefix for serverless functions)
// For local development, VITE_API_URL is empty (uses /api prefix, falls back to in-memory)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface RSVP {
  eventId: string;
  guestName: string;
  attending: 'Yes' | 'No' | 'not-sure';
  adults: number;
  kids: number;
  createdAt?: string;
  updatedAt?: string;
}

const rsvpsApi = {
  // Get RSVP for a specific event and guest
  async getRSVP(eventId: string, guestName: string): Promise<RSVP | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/rsvps/${encodeURIComponent(guestName)}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch RSVP');
      }
      return await response.json();
    } catch {
      return null;
    }
  },

  // Get all RSVPs for a specific event
  async getAllRSVPsForEvent(eventId: string): Promise<RSVP[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/rsvps/${eventId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch RSVPs');
      }
      return response.json();
    } catch {
      return [];
    }
  },

  // Create or update an RSVP
  async createOrUpdateRSVP(rsvp: RSVP): Promise<RSVP> {
    const response = await fetch(`${API_BASE_URL}/rsvps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventId: rsvp.eventId,
        guestName: rsvp.guestName,
        attending: rsvp.attending,
        adults: rsvp.adults,
        kids: rsvp.kids,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create/update RSVP');
    }

    return response.json();
  },

  // Delete an RSVP
  async deleteRSVP(eventId: string, guestName: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/rsvps/${encodeURIComponent(guestName)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete RSVP');
    }

    return await response.json();
  },

  // Get RSVP summary for an event
  async getRSVPSummary(eventId: string): Promise<{
    totalRSVPs: number;
    attendingCount: number;
    notAttendingCount: number;
    notSureCount: number;
    totalAdults: number;
    totalKids: number;
    totalAttendees: number;
  }> {
    const rsvps = await rsvpsApi.getAllRSVPsForEvent(eventId);

    return {
      totalRSVPs: rsvps.length,
      attendingCount: rsvps.filter(r => r.attending === 'Yes').length,
      notAttendingCount: rsvps.filter(r => r.attending === 'No').length,
      notSureCount: rsvps.filter(r => r.attending === 'not-sure').length,
      totalAdults: rsvps.filter(r => r.attending === 'Yes').reduce((sum, r) => sum + r.adults, 0),
      totalKids: rsvps.filter(r => r.attending === 'Yes').reduce((sum, r) => sum + r.kids, 0),
      totalAttendees: rsvps.filter(r => r.attending === 'Yes').reduce((sum, r) => sum + r.adults + r.kids, 0),
    };
  },
};

export default rsvpsApi;
