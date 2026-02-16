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

  // Track which item this guest has claimed
  const [claimedItemId, setClaimedItemId] = useState<string | null>(
    localStorage.getItem(getEventKey('claimed_item'))
  );

  // Local state for menu (with guest's claim)
  const [menuState, setMenuState] = useState<MenuItem[]>(() => {
    // Initialize from localStorage if available
    const storedMenu = localStorage.getItem(getEventKey('menu_state'));
    if (storedMenu) {
      try {
        return JSON.parse(storedMenu);
      } catch {
        return [];
      }
    }
    // Start with eventData.menu
    return eventData.menu.map(item => ({
      ...item,
      // If this guest has claimed this item, mark it
      claimedBy: item.id === claimedItemId ? guestName : item.claimedBy
    }));
  });

  // Sync menu state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(getEventKey('menu_state'), JSON.stringify(menuState));
  }, [menuState, eventId]);

  // 2. Countdown State
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isMenuLive, setIsMenuLive] = useState<boolean>(
    localStorage.getItem(getEventKey('menu_live')) === 'true'
  );

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

    // Find item in eventData.menu
    const item = eventData.menu.find(i => i.id === itemId);
    if (!item) return;

    if (item.claimedBy === guestName) {
      // Unclaim: this guest is unclaiming their own item
      setClaimedItemId(null);
      localStorage.removeItem(getEventKey('claimed_item'));
      // Update menu state
      setMenuState(prev => prev.map(i =>
        i.id === itemId
          ? { ...i, claimedBy: undefined }
          : i
      ));
    } else if (item.claimedBy) {
      // Someone else already claimed this item
      alert('This item is already claimed by ' + item.claimedBy);
    } else {
      // Claim this item
      setClaimedItemId(itemId);
      localStorage.setItem(getEventKey('claimed_item'), itemId);
      // Update menu state
      setMenuState(prev => prev.map(i =>
        i.id === itemId
          ? { ...i, claimedBy: guestName }
          : i
      ));
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
                        disabled={!isMenuLive}
                        onClick={() => handleClaim(item.id)}
                        className={`claim-button ${canClaim ? 'enabled' : 'disabled'}`}
                      >
                        Claim
                      </button>
                    )}

                    {isClaimedByCurrentUser && (
                      <button
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
