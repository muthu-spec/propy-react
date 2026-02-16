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
}

interface FamilyCount {
  adults: number;
  kids: number;
}

const GuestPage: React.FC<GuestPageProps> = ({ eventData }) => {
  // 1. Identify User from LocalStorage
  const [guestName, setGuestName] = useState<string>(localStorage.getItem('potluck_name') || '');
  const [isRegistered, setIsRegistered] = useState<boolean>(!!localStorage.getItem('potluck_name'));
  const [familyCount, setFamilyCount] = useState<FamilyCount>(
    {
      adults: parseInt(localStorage.getItem('potluck_adults') || '2'),
      kids: parseInt(localStorage.getItem('potluck_kids') || '0')
    }
  );
  const [isAttending, setIsAttending] = useState<string | null>(
    localStorage.getItem('potluck_attending') || null
  ); // null, 'Yes', 'No', 'not-sure'

  // 2. Countdown State
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isMenuLive, setIsMenuLive] = useState<boolean>(
    localStorage.getItem('potluck_menu_live') === 'true'
  );

  useEffect(() => {
    // If menu is already live, don't start timer
    if (isMenuLive) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(eventData.drop_time).getTime() - now;

      if (distance < 0) {
        setIsMenuLive(true);
        localStorage.setItem('potluck_menu_live', 'true');
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
    localStorage.setItem('potluck_name', guestName);
    localStorage.setItem('potluck_attending', isAttending || 'not-sure');
    localStorage.setItem('potluck_adults', familyCount.adults.toString());
    localStorage.setItem('potluck_kids', familyCount.kids.toString());
    setIsRegistered(true);
    // Logic: Update database with RSVP info
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
            {eventData.menu.map(item => (
              <div key={item.id} className={`menu-item ${item.claimedBy ? 'claimed' : 'available'}`}>
                <div className="menu-item-header">
                  <div>
                    <p className={`menu-item-label ${item.claimedBy ? 'line-through' : ''}`}>
                      {item.label}
                    </p>
                    {item.claimedBy && (
                      <p className="menu-item-claimer">Claimed by {item.claimedBy}</p>
                    )}
                  </div>

                  {!item.claimedBy && (
                    <button
                      disabled={!isMenuLive}
                      className={`claim-button ${isMenuLive ? 'enabled' : 'disabled'}`}
                    >
                      Claim
                    </button>
                  )}
                </div>
              </div>
            ))}
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
