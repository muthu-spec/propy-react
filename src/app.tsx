import React from 'react';
import { Routes, Route, useParams } from "react-router-dom";
import { Home } from './pages/home';
import { Favorites } from "./pages/favorites";
import { HostAuthSystem } from "./pages/host-auth";
import { HostDashboard } from "./pages/host-dashboard";
import GuestPage from "./pages/guest-page";
import { NavBar } from "./components/nav-bar";
import { MovieProvider } from "./contexts/movie-provider"
import './css/app.css'
import eventsApi, { type EventData } from './services/events-api';

function GuestPageWrapper() {
  const { eventId } = useParams<{ eventId: string }>();
  const [eventData, setEventData] = React.useState<EventData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchEventData = async () => {
      if (!eventId) return;

      try {
        setLoading(true);
        setError(null);
        const data = await eventsApi.getEventById(eventId);

        if (!data) {
          setError('Event not found. The link may be invalid or the event has been deleted.');
          return;
        }

        setEventData(data);
      } catch (err) {
        console.error('Failed to fetch event data:', err);
        setError('Failed to load event data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId]);

  if (loading) {
    return (
      <div className="loading-container">
        <p>Loading event...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <a href="/">Go to Home</a>
      </div>
    );
  }

  if (!eventData) {
    return null;
  }

  return <GuestPage eventData={eventData} eventId={eventId || ''} />;
}

function App() {
  return (
    <MovieProvider>
      <NavBar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/login" element={<HostAuthSystem />} />
          <Route path="/dashboard" element={<HostDashboard />} />
          <Route path="/join/:eventId" element={<GuestPageWrapper />} />
        </Routes>
      </main>
    </MovieProvider>
  )
}

export default App
