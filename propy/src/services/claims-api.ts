// Claims API Service for Multi-User Claim Tracking
// Uses Vercel serverless functions with Blob storage

// For Vercel deployment, VITE_API_URL is empty (uses /api prefix for serverless functions)
// For local development, VITE_API_URL is empty (uses /api prefix, falls back to in-memory)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface Claim {
  eventId: string;
  itemId: string;
  guestName: string;
  claimTime: string;
}

const claimsApi = {
  // Get all claims for a specific event
  async getClaimsForEvent(eventId: string): Promise<Claim[]> {
    const response = await fetch(`${API_BASE_URL}/claims/${eventId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch claims');
    }
    return response.json();
  },

  // Get claimer for a specific item
  async getItemClaimer(eventId: string, itemId: string): Promise<string | undefined> {
    const response = await fetch(`${API_BASE_URL}/claims/${eventId}/items/${itemId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch item claimer');
    }
    const data = await response.json();
    return data.claimedBy || undefined;
  },

  // Get which item a guest has claimed
  async getGuestClaimedItemId(eventId: string, guestName: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/claims/${eventId}/guests/${encodeURIComponent(guestName)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch guest claims');
      }
      const claims = await response.json();
      return claims.length > 0 ? claims[0].itemId : null;
    } catch {
      return null;
    }
  },

  // Add a new claim
  async addClaim(claim: Claim): Promise<Claim> {
    const response = await fetch(`${API_BASE_URL}/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(claim),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add claim');
    }

    return response.json();
  },

  // Remove a claim
  async removeClaim(eventId: string, itemId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/claims/${eventId}/items/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error('Failed to remove claim');
    }

    return await response.json();
  },

  // Clear all claims (for testing)
  async clearAllClaims(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/claims`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to clear claims');
    }
  }
};

export default claimsApi;
