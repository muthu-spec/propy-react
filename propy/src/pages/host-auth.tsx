import { useState } from 'react';
import '../css/host-auth.css'

export const HostAuthSystem = () => {
  // Auth State
  const [step, setStep] = useState('phone'); // 'phone', 'otp', 'dashboard'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  
  // Event Creation State
  const [eventDetails, setEventDetails] = useState({ title: '', date: '', location: '' });
  const [magicLink, setMagicLink] = useState('');

  // 1. Handle Phone Submission
  const handleSendOtp = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    // Logic: Trigger Firebase/Supabase Phone Auth here
    console.log("Sending OTP to", phoneNumber);
    setStep('otp');
  };

  // 2. Handle OTP Verification
  const handleVerifyOtp = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    // Logic: Verify 6-digit code
    if (otp === '123456') { // Mock verification
      setStep('dashboard');
    } else {
      alert("Invalid Code (Try 123456)");
    }
  };

  // 3. Create Event & Generate Magic Link
  const createEvent = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    const eventId = Math.random().toString(36).substring(2, 9);
    const generatedLink = `${window.location.origin}/join/${eventId}`;
    setMagicLink(generatedLink);
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

  return (
    <div className="host-dashboard">
      <h1>Host Dashboard</h1>

      {!magicLink ? (
        <form onSubmit={createEvent} className="event-form">
          <h2>Create New Potluck</h2>
          <input
            type="text"
            placeholder="Event Title (e.g. Summer BBQ)"
            required
            value={eventDetails.title}
            onChange={e => setEventDetails({...eventDetails, title: e.target.value})}
          />
          <div className="input-row">
            <input
              type="date"
              required
              value={eventDetails.date}
              onChange={e => setEventDetails({...eventDetails, date: e.target.value})}
            />
            <input
              type="text"
              placeholder="Location"
              required
              value={eventDetails.location}
              onChange={e => setEventDetails({...eventDetails, location: e.target.value})}
            />
          </div>
          <button type="submit" className="verify-button" style={{width: '100%'}}>
            Generate Magic Link
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
        </div>
      )}
    </div>
  );
};
