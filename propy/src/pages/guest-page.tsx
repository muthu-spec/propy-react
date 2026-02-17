import React, { useState, useEffect, type ChangeEvent } from 'react';
import '../css/guest-page.css';

// Types
interface MenuItem {
  id: string;
  label: string;
  claimedBy?: string;
}

interface EventData {
  title: string;
  date: string;
  location: string;
  drop_time: string;
  menu: MenuItem[];
}

interface GuestPageProps {
  eventData: EventData;
  eventId: string;
}

interface FamilyCount {
  adults: number;
  kids: number;
}

// Mock Database Types
interface Claim {
  eventId: string;
  itemId: string;
  guestName: string;
  claimTime: string;
}

// Mock Database for Multi-User Claim Tracking
// This simulates a database using localStorage to share claims across all users
const mockDatabase = {
  STORAGE_KEY: 'potluck_claims_database',

  getAllClaims(): Claim[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addClaim(claim: Claim): void {
    const claims = this.getAllClaims();
    claims.push(claim);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(claims));
  },

  removeClaim(eventId: string, itemId: string): void {
    const claims = this.getAllClaims().filter(
      c => !(c.eventId === eventId && c.itemId === itemId)
    );
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(claims));
  },

  getItemClaimer(eventId: string, itemId: string): string | undefined {
    const claims = this.getAllClaims();
    const claim = claims.find(
      c => c.eventId === eventId && c.itemId === itemId
    );
    return claim?.guestName;
  },

  isItemClaimed(eventId: string, itemId: string): boolean {
    return !!this.getItemClaimer(eventId, itemId);
  },

  // Get all claims for a specific event
  getClaimsForEvent(eventId: string): Claim[] {
    return this.getAllClaims().filter(c => c.eventId === eventId);
  },

  // Check if a specific guest has claimed any item in an event
  getGuestClaimedItemId(eventId: string, guestName: string): string | null {
    const claim = this.getAllClaims().find(
      c => c.eventId === eventId && c.guestName === guestName
    );
    return claim?.itemId || null;
  }
};

const GuestPage: React.FC<GuestPageProps> = ({ eventData, eventId }) => {
  // Generate event-specific localStorage keys
  const getEventKey = (key: string) => `potluck_${key}_${eventId}`;

  // 1. Identify User from LocalStorage
  const [guestName, setGuestName] = useState<string>(localStorage.getItem(getEventKey('name')) || '');
  const [isRegistered, setIsRegistered] = useState<boolean>(!!localStorage.getItem(getEventKey('name')));
  const [familyCount, setFamilyCount] = useState<FamilyCount>(
    {
      adults: parseInt(localStorage.getItem(getEventKey('adults')) || '2'),
      kids: parseInt(localStorage.getItem(getEventKey('kids')) || '0')
    }
  );
  const [isAttending, setIsAttending] = useState<string | null>(
    localStorage.getItem(getEventKey('attending')) || null
  ); // null, 'Yes', 'No', 'not-sure'

  // Track which item this guest has claimed (from mock database)
  const [claimedItemId, setClaimedItemId] = useState<string | null>(() => {
    // Check mock database for this guest's claim
    const claim = mockDatabase.getClaimsForEvent(eventId).find(
      c => c.guestName === guestName
    );
    return claim?.itemId || null;
  });

  // Local state for menu (initialized from mock database)
  const [menuState, setMenuState] = useState<MenuItem[]>(() => {
    // Get all claims for this event from mock database
    const eventClaims = mockDatabase.getClaimsForEvent(eventId);

    // Build menu with claim status from database
    return eventData.menu.map(item => {
      const claim = eventClaims.find(c => c.itemId === item.id);
      return {
        ...item,
        claimedBy: claim?.guestName
      };
    });
  });

  // Sync claimedItemId from database when guestName is available
  useEffect(() => {
    if (guestName) {
      const dbClaimedItemId = mockDatabase.getGuestClaimedItemId(eventId, guestName);
      setClaimedItemId(dbClaimedItemId);
    }
  }, [guestName, eventId]);

  // 2. Countdown State
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isMenuLive, setIsMenuLive] = useState<boolean>(
    localStorage.getItem(getEventKey('menu_live')) === 'true'
  );

  // Poll the database periodically to get updates from other users
  useEffect(() => {
    if (!isMenuLive) return;

    const pollInterval = setInterval(() => {
      const eventClaims = mockDatabase.getClaimsForEvent(eventId);

      // Refresh menu state from database
      setMenuState(prev => prev.map(item => {
        const claim = eventClaims.find(c => c.itemId === item.id);
        return {
          ...item,
          claimedBy: claim?.guestName
        };
      }));

      // Sync this guest's claimedItemId (functional update to prevent cascading renders)
      if (guestName) {
        setClaimedItemId(prev => {
          const dbClaimedItemId = mockDatabase.getGuestClaimedItemId(eventId, guestName);
          return dbClaimedItemId === prev ? prev : dbClaimedItemId;
        });
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [eventId, guestName, isMenuLive]);

  useEffect(() => {
    // If menu is already live, don't start timer
    if (isMenuLive) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(eventData.drop_time).getTime() - now;

      if (distance < 0) {
        setIsMenuLive(true);
        localStorage.setItem(getEventKey('menu_live'), 'true');
        clearInterval(timer);
      } else {
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [eventData.drop_time, isMenuLive]);

  const handleRSVP = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    localStorage.setItem(getEventKey('name'), guestName);
    localStorage.setItem(getEventKey('attending'), isAttending || 'not-sure');
    localStorage.setItem(getEventKey('adults'), familyCount.adults.toString());
    localStorage.setItem(getEventKey('kids'), familyCount.kids.toString());
    setIsRegistered(true);
    // Logic: Update database with RSVP info
  };

  const handleClaim = (itemId: string) => {
    if (!isMenuLive) return;

    // Find item in current menu state (to get latest claimedBy info)
    const currentItem = menuState.find(i => i.id === itemId);
    if (!currentItem) return;

    // Check if already claimed by anyone (not just this guest)
    if (currentItem.claimedBy) {
      if (currentItem.claimedBy === guestName) {
        // This guest is unclaiming their own item
        setClaimedItemId(null);
        // Remove claim from mock database
        mockDatabase.removeClaim(eventId, itemId);
        // Update menu state
        setMenuState(prev => prev.map(i =>
          i.id === itemId
            ? { ...i, claimedBy: undefined }
            : i
        ));
      } else {
        // Someone else already claimed this item
        alert('This item is already claimed by ' + currentItem.claimedBy);
      }
      return;
    }

    // Check if this guest has already claimed something (one item limit)
    if (claimedItemId) {
      alert('You can only claim one item. Unclaim your current item first.');
      return;
    }

    // Claim this item
    setClaimedItemId(itemId);
    // Add claim to mock database
    mockDatabase.addClaim({
      eventId,
      itemId,
      guestName,
      claimTime: new Date().toISOString()
    });
    // Update menu state
    setMenuState(prev => prev.map(i =>
      i.id === itemId
        ? { ...i, claimedBy: guestName }
        : i
    ));
  };

  // --- UI Renders ---

  // STEP 1: Registration / RSVP
  if (!isRegistered) return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">You're Invited!</h2>
        <p className="auth-subtitle">{eventData.title} <br/> {eventData.date} @ {eventData.location}</p>

        <form onSubmit={handleRSVP}>
          <label>Family Name</label>
          <input
            className="auth-input"
            placeholder="e.g., The Miller Family"
            required
            value={guestName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setGuestName(e.target.value)}
          />

          <label>Will you be attending?</label>
          <div className="attending-options">
            <label className="attending-option">
              <input
                type="radio"
                name="attending"
                value="Yes"
                checked={isAttending === 'Yes'}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setIsAttending(e.target.value)}
              />
              <span>Yes</span>
            </label>
            <label className="attending-option">
              <input
                type="radio"
                name="attending"
                value="No"
                checked={isAttending === 'No'}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setIsAttending(e.target.value)}
              />
              <span>No</span>
            </label>
            <label className="attending-option">
              <input
                type="radio"
                name="attending"
                value="not-sure"
                checked={isAttending === 'not-sure'}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setIsAttending(e.target.value)}
              />
              <span>Not sure yet</span>
            </label>
          </div>

          {isAttending === 'Yes' && (
            <div className="family-count">
              <div className="family-count-item">
                <label>Adults</label>
                <input type="number" className="auth-input mb-0" value={familyCount.adults}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFamilyCount({...familyCount, adults: parseInt(e.target.value) || 0})} />
              </div>
              <div className="family-count-item">
                <label>Kids</label>
                <input type="number" className="auth-input mb-0" value={familyCount.kids}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFamilyCount({...familyCount, kids: parseInt(e.target.value) || 0})} />
              </div>
            </div>
          )}

          <button className="btn-primary">RSVP</button>
        </form>
      </div>
    </div>
  );

  // STEP 2: The Main Dashboard (Post-RSVP)
  return (
    <div className="guest-dashboard">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <h1>{eventData.title}</h1>
          <p className="welcome-text">Welcome back, {guestName}!</p>
          {isAttending && (
            <p className="attendance-status">
              Status: <span className={
                isAttending === 'Yes' ? 'status-attending' :
                isAttending === 'No' ? 'status-not-attending' :
                'status-not-sure'
              }>
                {isAttending === 'Yes' ? 'Attending' :
                 isAttending === 'No' ? 'Not attending' :
                 'Not sure yet'}
              </span>
              {isAttending === 'Yes' && ` (${familyCount.adults} adults, ${familyCount.kids} kids)`}
            </p>
          )}
        </header>

        {/* The Fairness Countdown */}
        {!isMenuLive ? (
          <div className="countdown-banner">
            <p className="countdown-label">Menu Drops In:</p>
            <p className="countdown-time">{timeLeft}</p>
            <p className="countdown-note">Get ready! Items are first-come, first-served.</p>
          </div>
        ) : (
          <div className="live-banner">
            🚀 The Menu is LIVE! Claim your items!
          </div>
        )}

        {/* Menu Items */}
        {isAttending === 'Yes' ? (
          <div className="menu-section">
            <h3>Potluck Menu</h3>
            {menuState.map(item => {
              const isClaimedByCurrentUser = item.claimedBy === guestName;
              const canClaim = !item.claimedBy && isMenuLive && !claimedItemId;
              const isAlreadyClaimed = !!item.claimedBy;

              return (
                <div key={item.id} className={`menu-item ${
                  item.claimedBy ? 'claimed' : 'available'
                } ${isClaimedByCurrentUser ? 'my-claimed' : ''}`}>
                  <div className="menu-item-header">
                    <div>
                      <p className={`menu-item-label ${item.claimedBy ? 'line-through' : ''}`}>
                        {item.label}
                      </p>
                      {item.claimedBy && !isClaimedByCurrentUser && (
                        <p className="menu-item-claimer">Claimed by {item.claimedBy}</p>
                      )}
                    </div>

                    {!item.claimedBy && (
                      <button
                        disabled={!isMenuLive || isAlreadyClaimed}
                        onClick={() => handleClaim(item.id)}
                        className={`claim-button ${canClaim ? 'enabled' : 'disabled'}`}
                      >
                        Claim
                      </button>
                    )}

                    {isClaimedByCurrentUser && (
                      <button
                        disabled={!isMenuLive}
                        onClick={() => handleClaim(item.id)}
                        className="unclaim-button"
                        title="Unclaim this item"
                      >
                        Unclaim
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="not-attending-message">
            <p>
              {isAttending === 'No'
                ? "Since you're not attending, you won't be able to claim menu items."
                : "Please confirm your attendance to access menu and claim items."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestPage;
