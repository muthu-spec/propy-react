import React, { useState, useEffect, useRef, type ChangeEvent } from 'react';
import '../css/guest-page.css';
import claimsApi from '../services/claims-api';
import rsvpsApi from '../services/rsvps-api';
import guestMenuLiveApi from '../services/guest-menu-live-api';

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
  drop_time?: string;
  menu: MenuItem[];
  event_type: 'potluck' | 'birthday';
  rsvp_deadline?: string;
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
  // 1. RSVP State (loaded from Supabase)
  const [guestName, setGuestName] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [familyCount, setFamilyCount] = useState<FamilyCount>({
    adults: 2,
    kids: 0
  });
  const [isAttending, setIsAttending] = useState<'Yes' | 'No' | 'not-sure'>('not-sure');

  // Track which item this guest has claimed (from API)
  const [claimedItemId, setClaimedItemId] = useState<string | null>(null);

  // Local state for menu (initialized from API)
  const [menuState, setMenuState] = useState<MenuItem[]>(eventData.menu);

  // Track if claims have been loaded to prevent duplicate API calls
  const claimsLoadedRef = useRef<Set<string>>(new Set());

  // 2. Countdown State (loaded from Supabase)
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isMenuLive, setIsMenuLive] = useState<boolean>(false);

  // RSVP Deadline countdown state
  const [rsvpTimeLeft, setRsvpTimeLeft] = useState<string>("");
  const [rsvpDeadlinePassed, setRsvpDeadlinePassed] = useState<boolean>(false);

  // Load RSVP from Supabase on component mount
  useEffect(() => {
    const loadRSVPFromSupabase = async () => {
      try {
        // Get all RSVPs for this event
        const allRSVPs = await rsvpsApi.getAllRSVPsForEvent(eventId);
        console.log('Loaded RSVPs from Supabase:', allRSVPs);

        // For now, we don't pre-populate the form
        // Users will need to RSVP again to create their record in Supabase
      } catch (error) {
        console.error('Failed to load RSVPs from Supabase:', error);
      }
    };

    loadRSVPFromSupabase();
  }, [eventId]);

  // Load menu live status from Supabase on component mount
  useEffect(() => {
    const loadMenuLiveStatus = async () => {
      try {
        const menuLiveStatus = await guestMenuLiveApi.getMenuLiveStatus(eventId);
        console.log('Loaded menu live status from Supabase:', menuLiveStatus);
        if (menuLiveStatus) {
          setIsMenuLive(menuLiveStatus.is_live);
        }
      } catch (error) {
        console.error('Failed to load menu live status:', error);
      }
    };

    loadMenuLiveStatus();
  }, [eventId]);

  // RSVP Deadline countdown
  useEffect(() => {
    if (!eventData.rsvp_deadline) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const deadline = new Date(eventData.rsvp_deadline!).getTime();
      const distance = deadline - now;

      if (distance < 0) {
        setRsvpDeadlinePassed(true);
        setRsvpTimeLeft("Deadline passed");
        clearInterval(timer);
      } else {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        if (days > 0) {
          setRsvpTimeLeft(`${days}d ${hours}h ${minutes}m`);
        } else {
          setRsvpTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [eventData.rsvp_deadline]);

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

        // Mark as loaded
        claimsLoadedRef.current.add(eventId);
      } catch (error) {
        console.error('Failed to load event claims:', error);
      }
    };

    // Only load claims once per eventId (not on every render)
    if (!claimsLoadedRef.current.has(eventId)) {
      loadClaims();
    }
  }, [eventData.menu, eventId]);

  // Countdown timer
  useEffect(() => {
    // If menu is already live, don't start timer
    if (isMenuLive || !eventData.drop_time) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = new Date(eventData.drop_time!).getTime() - now;

      if (distance < 0) {
        setIsMenuLive(true);
        clearInterval(timer);
        // Sync to Supabase
        guestMenuLiveApi.setMenuLiveStatus(eventId, true)
          .catch(error => console.error('Failed to sync menu live status:', error));
      } else {
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [eventData.drop_time, eventId, isMenuLive]);

  const handleRSVP = async (e: {
    currentTarget: HTMLFormElement; preventDefault: () => void 
}) => {
    e.preventDefault();

    const newGuestName = guestName.trim();
    // Get the actual attending value from form (not from state)
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    // Cast to union type explicitly to avoid TypeScript error
    const newAttending = (formData.get('attending') as string) as 'Yes' | 'No' | 'not-sure' | null;

    if (!newGuestName || !newAttending) {
      alert('Please enter your name and select attendance status.');
      return;
    }

    // Save to Supabase (not localStorage)
    try {
      await rsvpsApi.createOrUpdateRSVP({
        eventId,
        guestName: newGuestName,
        attending: newAttending,
        adults: familyCount.adults,
        kids: familyCount.kids,
      });
      console.log('RSVP saved to Supabase');
    } catch (error) {
      console.error('Failed to save RSVP to Supabase:', error);
      alert('Failed to save RSVP. Please try again.');
      return;
    }

    setIsRegistered(true);
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
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  setIsAttending(value === 'Yes' ? 'Yes' : value === 'No' ? 'No' : 'not-sure');
                }}
              />
              <span>Yes</span>
            </label>
            <label className="attending-option">
              <input
                type="radio"
                name="attending"
                value="No"
                checked={isAttending === 'No'}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  setIsAttending(value === 'Yes' ? 'Yes' : value === 'No' ? 'No' : 'not-sure');
                }}
              />
              <span>No</span>
            </label>
            <label className="attending-option">
              <input
                type="radio"
                name="attending"
                value="not-sure"
                checked={isAttending === 'not-sure'}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  setIsAttending(value === 'Yes' ? 'Yes' : value === 'No' ? 'No' : 'not-sure');
                }}
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
          <div className="event-title-row">
            <h1>{eventData.title}</h1>
            <span className={`event-type-badge ${eventData.event_type}`}>
              {eventData.event_type === 'potluck' ? '🍽 Potluck' : '🎂 Birthday'}
            </span>
          </div>
          <p className="welcome-text">Welcome back, {guestName || 'Guest'}!</p>
          {isRegistered && isAttending && (
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

        {/* RSVP Deadline Countdown */}
        {eventData.rsvp_deadline && !rsvpDeadlinePassed && (
          <div className="rsvp-deadline-banner">
            <p className="rsvp-deadline-label">RSVP Deadline:</p>
            <p className="rsvp-deadline-time">{rsvpTimeLeft}</p>
            <p className="rsvp-deadline-note">Please RSVP by this date</p>
          </div>
        )}

        {/* The Menu Countdown (only for potluck events) */}
        {eventData.event_type === 'potluck' && (
          <>
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
          </>
        )}

        {/* Menu Items (only for potluck events with menu) */}
        {eventData.event_type === 'potluck' && isAttending === 'Yes' ? (
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
              {eventData.event_type === 'potluck'
                ? (isAttending === 'No'
                    ? "Since you're not attending, you won't be able to claim menu items."
                    : "Please confirm your attendance to access menu and claim items.")
                : "Please confirm your attendance."}
            </p>
          </div>
        )}

        {/* Menu Coming Soon Message */}
        {eventData.event_type === 'potluck' && isAttending === 'Yes' && menuState.length === 0 && (
          <div className="menu-coming-soon-message">
            <p>
              {isMenuLive
                ? "Menu items are being finalized. Check back soon!"
                : "Menu items will be available after the RSVP deadline. Check back soon!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestPage;
