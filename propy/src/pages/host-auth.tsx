import { useState } from 'react';
import '../css/host-auth.css'
import eventsApi from '../services/events-api';

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

    setIsLoading(true);

    try {
      // Generate event ID
      const newEventId = Math.random().toString(36).substring(2, 9);

      // Set default drop time if not provided (3 hours from now)
      const dropTime = eventDetails.drop_time ||
        new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

      // Create event data object
      const eventData = {
        eventId: newEventId,
        title: eventDetails.title,
        date: eventDetails.date,
        location: eventDetails.location,
        drop_time: dropTime,
        menu: menuItems,
        phone: phoneNumber,
        createdAt: new Date().toISOString(),
      };

      // Save to Vercel Blob
      await eventsApi.createEvent(eventData);

      // Generate magic link
      const generatedLink = `${window.location.origin}/join/${newEventId}`;
      setMagicLink(generatedLink);
      setStep('event-details');
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
          <h2>Create New Potluck</h2>

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
        <div className="magic-link-card">
          <h2>Event Created!</h2>
          <p>Share this link with your guests:</p>
          <div className="magic-link-wrapper">
            <div className="magic-link-container">
              {magicLink}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(magicLink)}
              className="copy-button"
              title="Copy Link"
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1Z" fill="currentColor"/>
                <path d="M15 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H15C16.1 23 17 22.1 17 21V7C17 5.9 16.1 5 15 5ZM15 21H8V7H15V21Z" fill="currentColor"/>
              </svg>
            </button>
          </div>

          <div style={{marginTop: '2rem'}}>
            <h3>Event Details:</h3>
            <p><strong>Title:</strong> {eventDetails.title}</p>
            <p><strong>Date:</strong> {eventDetails.date}</p>
            <p><strong>Location:</strong> {eventDetails.location}</p>
            <p><strong>Drop Time:</strong> {new Date(eventDetails.drop_time || Date.now()).toLocaleString()}</p>
            <p><strong>Menu Items:</strong> {menuItems.length} items</p>
          </div>

          <button
            onClick={() => {
              setMagicLink('');
              setEventDetails({ title: '', date: '', location: '', drop_time: '' });
              setMenuItems([]);
              setNewMenuItem('');
            }}
            className="verify-button"
            style={{marginTop: '1rem'}}
          >
            Create Another Event
          </button>
        </div>
      )}
    </div>
  );

  return null; // Should not reach here
};
