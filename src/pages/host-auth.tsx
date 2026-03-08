import { useState } from 'react';
import '../css/host-auth.css';
import eventsApi from '../services/events-api';
import { EventDetailsCard } from '../components/event-details-card';

interface MenuItem {
  id: string;
  label: string;
}

export const HostAuthSystem = () => {
  // Auth State
  const [step, setStep] = useState('phone'); // 'phone', 'otp', 'dashboard', 'event-details'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');

  // Event Creation State
  const [eventDetails, setEventDetails] = useState({
    title: '',
    date: '',
    location: '',
    event_type: 'potluck' as 'potluck' | 'birthday',
    rsvp_deadline: '',
    schedulePreference: 'now' as 'now' | 'later',
    drop_time: '',
  });
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [newMenuItem, setNewMenuItem] = useState('');
  const [magicLink, setMagicLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 1. Handle Phone Submission
  const handleSendOtp = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    console.log("Sending OTP to", phoneNumber);
    setStep('otp');
  };

  // 2. Handle OTP Verification
  const handleVerifyOtp = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    if (otp === '123456') {
      setStep('dashboard');
    } else {
      alert("Invalid Code (Try 123456)");
    }
  };

  // Add a menu item
  const addMenuItem = () => {
    if (newMenuItem.trim()) {
      const id = (menuItems.length + 1).toString();
      setMenuItems([...menuItems, { id, label: newMenuItem.trim() }]);
      setNewMenuItem('');
    }
  };

  // Remove a menu item
  const removeMenuItem = (id: string) => {
    setMenuItems(menuItems.filter(item => item.id !== id));
  };

  // 3. Create Event & Generate Magic Link
  const createEvent = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();

    if (!eventDetails.title || !eventDetails.date || !eventDetails.location) {
      alert('Please fill in all required fields');
      return;
    }

    if (!eventDetails.rsvp_deadline) {
      alert('Please set RSVP deadline');
      return;
    }

    // Validate RSVP deadline is before event date
    const eventDate = new Date(eventDetails.date);
    const rsvpDeadline = new Date(eventDetails.rsvp_deadline);
    if (rsvpDeadline >= eventDate) {
      alert('RSVP deadline must be before the event date');
      return;
    }

    setIsLoading(true);

    try {
      // Generate event ID
      const newEventId = Math.random().toString(36).substring(2, 9);

      // Set drop time based on schedule preference
      let dropTime: string | undefined;
      if (eventDetails.schedulePreference === 'now') {
        dropTime = eventDetails.drop_time ||
          new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      }

      // Create event data object
      const eventData = {
        eventId: newEventId,
        title: eventDetails.title,
        date: eventDetails.date,
        location: eventDetails.location,
        drop_time: dropTime,
        menu: eventDetails.schedulePreference === 'now' ? menuItems : [],
        event_type: eventDetails.event_type,
        rsvp_deadline: eventDetails.rsvp_deadline,
        phone: phoneNumber,
        createdAt: new Date().toISOString(),
      };

      // Save to Vercel Blob
      await eventsApi.createEvent(eventData);

      // Generate magic link
      const generatedLink = `${window.location.origin}/join/${newEventId}`;
      setMagicLink(generatedLink);
      // Note: step stays as 'dashboard', magic link is shown when magicLink is set
    } catch (error) {
      console.error('Failed to create event:', error);
      alert('Failed to create event. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- UI Renders ---

  if (step === 'phone') return (
    <div className="host-layout">
        <div className="host-auth-card">
            <form onSubmit={handleSendOtp} className="host-login-form">
                <h2>Host Login</h2>
                <div className='input-group'>
                <label htmlFor="phone-number">Phone Number</label>
                    <input
                        type="tel"
                        id="phone-number"
                        required
                        placeholder="+1 (555) 000-0000"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                </div>
                <button className="send-button">
                    Send Code
                </button>
            </form>
        </div>
    </div>
  );

  if (step === 'otp') return (
    <div className="host-layout">
      <div className="host-auth-card">
        <form onSubmit={handleVerifyOtp} className="otp-form">
          <h2>Verify Phone</h2>
          <p>Enter the 6-digit code sent to {phoneNumber}</p>
          <input
            type="text"
            required
            placeholder="000000"
            maxLength={6}
            className="otp-input"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button type="submit" className="verify-button">
            Verify & Login
          </button>
          <button type="button" onClick={() => setStep('phone')} className="back-button">
            Back to phone
          </button>
        </form>
      </div>
    </div>
  );

  if (step === 'dashboard') return (
    <div className="host-dashboard">
      <h1>Host Dashboard</h1>

      {!magicLink ? (
        <form onSubmit={createEvent} className="event-form">
          <h2>Create New Event</h2>

          {/* Event Type Selection */}
          <div className="event-type-section">
            <label>Event Type *</label>
            <div className="event-type-options">
              <label className="event-type-option">
                <input
                  type="radio"
                  name="event_type"
                  value="potluck"
                  checked={eventDetails.event_type === 'potluck'}
                  onChange={e => setEventDetails({...eventDetails, event_type: e.target.value as 'potluck' | 'birthday'})}
                />
                <span>Potluck</span>
              </label>
              <label className="event-type-option">
                <input
                  type="radio"
                  name="event_type"
                  value="birthday"
                  checked={eventDetails.event_type === 'birthday'}
                  onChange={e => setEventDetails({...eventDetails, event_type: e.target.value as 'potluck' | 'birthday'})}
                />
                <span>Birthday</span>
              </label>
            </div>
          </div>

          <label htmlFor="event-title">Event Title *</label>
          <input
            id="event-title"
            type="text"
            placeholder="Event Title (e.g. Summer BBQ)"
            required
            value={eventDetails.title}
            onChange={e => setEventDetails({...eventDetails, title: e.target.value})}
          />

          <div className="input-row">
            <div className="input-group">
              <label htmlFor="event-date">Date *</label>
              <input
                id="event-date"
                type="date"
                required
                value={eventDetails.date}
                onChange={e => setEventDetails({...eventDetails, date: e.target.value})}
              />
            </div>
            <div className="input-group">
              <label htmlFor="event-location">Location *</label>
              <input
                id="event-location"
                type="text"
                placeholder="Location"
                required
                value={eventDetails.location}
                onChange={e => setEventDetails({...eventDetails, location: e.target.value})}
              />
            </div>
          </div>

          {/* RSVP Deadline */}
          <label htmlFor="rsvp-deadline">RSVP Deadline *</label>
          <input
            id="rsvp-deadline"
            type="datetime-local"
            required
            value={eventDetails.rsvp_deadline ? eventDetails.rsvp_deadline.slice(0, 16) : ''}
            onChange={e => setEventDetails({...eventDetails, rsvp_deadline: new Date(e.target.value).toISOString()})}
          />

          {/* Menu Section - Only for Potluck events */}
          {eventDetails.event_type === 'potluck' && (
            <>
              <div className="menu-schedule-section">
                <label>Schedule Menu</label>
                <div className="schedule-options">
                  <label className="schedule-option">
                    <input
                      type="radio"
                      name="schedule-preference"
                      value="now"
                      checked={eventDetails.schedulePreference === 'now'}
                      onChange={e => setEventDetails({...eventDetails, schedulePreference: e.target.value as 'now' | 'later'})}
                    />
                    <span>Now</span>
                  </label>
                  <label className="schedule-option">
                    <input
                      type="radio"
                      name="schedule-preference"
                      value="later"
                      checked={eventDetails.schedulePreference === 'later'}
                      onChange={e => setEventDetails({...eventDetails, schedulePreference: e.target.value as 'now' | 'later'})}
                    />
                    <span>Later (after RSVP deadline)</span>
                  </label>
                </div>
              </div>

              {eventDetails.schedulePreference === 'now' && (
                <>
                  <label htmlFor="event-drop-time">Menu Drop Time (optional)</label>
                  <input
                    id="event-drop-time"
                    type="datetime-local"
                    value={eventDetails.drop_time ? eventDetails.drop_time.slice(0, 16) : ''}
                    onChange={e => setEventDetails({...eventDetails, drop_time: new Date(e.target.value).toISOString()})}
                  />

                  <h3>Menu Items</h3>
                  <div className="menu-input-row">
                    <input
                      type="text"
                      placeholder="Add menu item (e.g. Grilled Burgers)"
                      value={newMenuItem}
                      onChange={e => setNewMenuItem(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addMenuItem();
                        }
                      }}
                    />
                    <button type="button" onClick={addMenuItem} className="add-menu-button">
                      Add Item
                    </button>
                  </div>

                  {menuItems.length > 0 && (
                    <div className="menu-items-list">
                      {menuItems.map((item) => (
                        <div key={item.id} className="menu-item-row">
                          <span>{item.label}</span>
                          <button
                            type="button"
                            onClick={() => removeMenuItem(item.id)}
                            className="remove-menu-button"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {eventDetails.schedulePreference === 'later' && (
                <p className="schedule-later-note">
                  You can add menu items and set drop time after the RSVP deadline. We'll send you a reminder.
                </p>
              )}
            </>
          )}

          <button
            type="submit"
            className="verify-button"
            style={{width: '100%'}}
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Generate Magic Link'}
          </button>
        </form>
      ) : (
        <EventDetailsCard
          title={eventDetails.title}
          date={eventDetails.date}
          location={eventDetails.location}
          drop_time={eventDetails.drop_time || new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()}
          menuItems={menuItems}
          magicLink={magicLink}
          onCopyLink={() => navigator.clipboard.writeText(magicLink)}
          onCreateAnother={() => {
            setMagicLink('');
            setEventDetails({
              title: '',
              date: '',
              location: '',
              event_type: 'potluck',
              rsvp_deadline: '',
              schedulePreference: 'now',
              drop_time: ''
            });
            setMenuItems([]);
            setNewMenuItem('');
          }}
        />
      )}
    </div>
  );

  return null; // Should not reach here
};
