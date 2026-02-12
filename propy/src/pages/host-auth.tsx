import { useState } from 'react';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <form onSubmit={handleSendOtp} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Host Login</h2>
        <p className="text-gray-500 mb-6">Enter your phone to manage your potlucks.</p>
        <input 
          type="tel" required placeholder="+1 (555) 000-0000"
          className="w-full border-2 border-gray-200 rounded-lg p-3 mb-4 focus:border-blue-500 outline-none"
          value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
        />
        <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">
          Send Verification Code
        </button>
      </form>
    </div>
  );

  if (step === 'otp') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <form onSubmit={handleVerifyOtp} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-2 text-gray-800">Verify Phone</h2>
        <p className="text-gray-500 mb-6">Enter the 6-digit code sent to {phoneNumber}</p>
        <input 
          type="text" required placeholder="000000"
          className="w-full tracking-[1em] text-center text-2xl border-2 border-gray-200 rounded-lg p-3 mb-4 focus:border-blue-500 outline-none"
          value={otp} onChange={(e) => setOtp(e.target.value)}
        />
        <button className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700">
          Verify & Login
        </button>
        <button onClick={() => setStep('phone')} className="w-full mt-4 text-gray-500 text-sm">Back to phone</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Host Dashboard</h1>
        
        {!magicLink ? (
          <form onSubmit={createEvent} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
            <h2 className="text-xl font-semibold">Create New Potluck</h2>
            <input 
              type="text" placeholder="Event Title (e.g. Summer BBQ)" required
              className="w-full border p-3 rounded-lg"
              onChange={e => setEventDetails({...eventDetails, title: e.target.value})}
            />
            <div className="flex gap-4">
              <input type="date" className="border p-3 rounded-lg flex-1" required onChange={e => setEventDetails({...eventDetails, date: e.target.value})} />
              <input type="text" placeholder="Location" className="border p-3 rounded-lg flex-1" required onChange={e => setEventDetails({...eventDetails, location: e.target.value})} />
            </div>
            <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">Generate Magic Link</button>
          </form>
        ) : (
          <div className="bg-green-50 border-2 border-green-200 p-6 rounded-xl text-center">
            <h2 className="text-green-800 font-bold mb-2">Event Created!</h2>
            <p className="text-sm text-green-700 mb-4">Share this link with your guests via WhatsApp:</p>
            <div className="bg-white p-3 rounded border border-green-300 font-mono text-blue-600 break-all mb-4">
              {magicLink}
            </div>
            <button 
              onClick={() => navigator.clipboard.writeText(magicLink)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium"
            >
              Copy Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
