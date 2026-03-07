// Guest Menu Live API Service for Menu Availability Tracking
// Uses Vercel serverless functions with Supabase storage

// For Vercel deployment, VITE_API_URL is empty (uses /api prefix for serverless functions)
// For local development, VITE_API_URL is empty (uses /api prefix, falls back to in-memory)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface MenuLiveStatus {
  eventId: string;
  is_live: boolean;
}

const guestMenuLiveApi = {
  // Get menu live status for a specific event
  async getMenuLiveStatus(eventId: string): Promise<MenuLiveStatus | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/guest-menu-live/${eventId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch menu live status');
      }
      return await response.json();
    } catch {
      return null;
    }
  },

  // Set menu live status for an event
  async setMenuLiveStatus(eventId: string, isLive: boolean): Promise<MenuLiveStatus> {
    const response = await fetch(`${API_BASE_URL}/guest-menu-live/${eventId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventId,
        isLive,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to set menu live status');
    }

    return response.json();
  },

  // Delete menu live status for an event
  async deleteMenuLiveStatus(eventId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/guest-menu-live/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete menu live status');
    }

    return response.json();
  },
};

export default guestMenuLiveApi;
