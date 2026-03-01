import React, { useState, useEffect, type ChangeEvent } from 'react';
import '../css/guest-page.css';
import claimsApi from '../services/claims-api';

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

  // Track which item this guest has claimed (from API)
  const [claimedItemId, setClaimedItemId] = useState<string | null>(null);

  // Local state for menu (initialized from API)
  const [menuState, setMenuState] = useState<MenuItem[]>(eventData.menu);

  // Load event claims and menu state on mount
  useEffect(() => {
    const loadClaims = async () => {
      try {
        const eventClaims = await claimsApi.getClaimsForEvent(eventId);
        console.log('Loaded event claims:', eventClaims);

        // Build menu with claim status from API
        setMenuState(eventData.menu.map(item => {
          const claim = eventClaims.find(c => c.itemId === item.id);
          return {
            ...item,
            claimedBy: claim?.guestName
          };
        }));
      } catch (error) {
        console.error('Failed to load event claims:', error);
      }
    };

    loadClaims();
  }, [eventId, eventData.menu]);

  // Load this guest's claimed item from API
  useEffect(() => {
    const loadGuestClaim = async () => {
      if (!guestName) {
        setClaimedItemId(null);
        return;
      }

      try {
        const dbClaimedItemId = await claimsApi.getGuestClaimedItemId(eventId, guestName);
        console.log('Guest claimed item loaded:', { guestName, claimedItemId: dbClaimedItemId });
        setClaimedItemId(dbClaimedItemId);
      } catch (error) {
        console.error('Failed to load guest claim:', error);
        setClaimedItemId(null);
      }
    };

    loadGuestClaim();
  }, [guestName, eventId]);

  // 2. Countdown State
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isMenuLive, setIsMenuLive] = useState<boolean>(
    localStorage.getItem(getEventKey('menu_live')) === 'true'
  );

  // Poll the API periodically to get updates from other users
  useEffect(() => {
    if (!isMenuLive) return;

    const pollInterval = setInterval(async () => {
      try {
        const eventClaims = await claimsApi.getClaimsForEvent(eventId);

        // Refresh menu state from API
        setMenuState(prev => prev.map(item => {
          const claim = eventClaims.find(c => c.itemId === item.id);
          return {
            ...item,
            claimedBy: claim?.guestName
          };
        }));

        // Sync this guest's claimedItemId
        if (guestName) {
          const dbClaimedItemId = await claimsApi.getGuestClaimedItemId(eventId, guestName);
          setClaimedItemId(dbClaimedItemId);
        }
      } catch (error) {
        console.error('Failed to poll claims:', error);
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

  const handleClaim = async (itemId: string) => {
    if (!isMenuLive) return;

    console.log('handleClaim called:', { itemId, guestName, claimedItemId, isMenuLive });

    // Find item in current menu state (to get latest claimedBy info)
    const currentItem = menuState.find(i => i.id === itemId);
    if (!currentItem) {
      console.error('Item not found:', itemId);
      return;
    }

    // Check if already claimed by anyone (not just this guest)
    if (currentItem.claimedBy) {
      if (currentItem.claimedBy === guestName) {
        // This guest is unclaiming their own item
        try {
          setClaimedItemId(null);
          // Remove claim from API
          await claimsApi.removeClaim(eventId, itemId);
          // Update menu state
          setMenuState(prev => prev.map(i =>
            i.id === itemId
              ? { ...i, claimedBy: undefined }
              : i
          ));
          console.log('Item unclaimed:', itemId);
        } catch (error) {
          alert('Failed to unclaim item. Please try again.');
          console.error('Unclaim error:', error);
        }
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
    try {
      setClaimedItemId(itemId);
      // Add claim to API
      await claimsApi.addClaim({
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
      console.log('Item claimed:', itemId);
    } catch (error) {
      // Reset claimedItemId if API call failed
      setClaimedItemId(null);
      alert('Failed to claim item. It may have been claimed by someone else. Please refresh.');
      console.error('Claim error:', error);
    }
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
                <input
                  type="number"
                  className="auth-input mb-0"
                  value={familyCount.adults}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFamilyCount({...familyCount, adults: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="family-count-item">
                <label>Kids</label>
                <input
                  type="number"
                  className="auth-input mb-0"
                  value={familyCount.kids}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFamilyCount({...familyCount, kids: parseInt(e.target.value) || 0})}
                />
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
