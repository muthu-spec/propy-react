import React, { useState, useEffect } from 'react';
import '../css/host-dashboard.css';
import eventsApi from '../services/events-api';

interface MenuItem {
  id: string;
  label: string;
}

interface EventDisplay {
  eventId: string;
  title: string;
  date: string;
  location: string;
  event_type: 'potluck' | 'birthday';
  menu: MenuItem[];
  drop_time: string | undefined;
  rsvp_deadline: string | undefined;
}

interface MenuFormData {
  eventId: string;
  drop_time: string;
  menuItems: MenuItem[];
}

export const HostDashboard = () => {
  const [events, setEvents] = useState<EventDisplay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEvent, setSelectedEvent] = useState<EventDisplay | null>(null);
  const [menuForm, setMenuForm] = useState<MenuFormData>({
    eventId: '',
    drop_time: '',
    menuItems: []
  });
  const [newMenuItem, setNewMenuItem] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Load all events on mount
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const data = await eventsApi.getAllEvents();

        // Fetch full event details for each event
        const eventsWithDetails = await Promise.all(
          data.map(async (event) => {
            const fullEvent = await eventsApi.getEventById(event.eventId);
            return {
              eventId: event.eventId,
              title: fullEvent?.title || '',
              date: fullEvent?.date || '',
              location: fullEvent?.location || '',
              event_type: fullEvent?.event_type || 'potluck',
              menu: fullEvent?.menu || [],
              drop_time: fullEvent?.drop_time,
              rsvp_deadline: fullEvent?.rsvp_deadline
            };
          })
        );

        setEvents(eventsWithDetails.filter((e): e is EventDisplay => e !== null));
      } catch (error) {
        console.error('Failed to load events:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  // Open menu form for an event
  const openMenuForm = (event: EventDisplay) => {
    setSelectedEvent(event);
    setMenuForm({
      eventId: event.eventId,
      drop_time: event.drop_time || '',
      menuItems: event.menu || []
    });
  };

  // Close menu form
  const closeMenuForm = () => {
    setSelectedEvent(null);
    setNewMenuItem('');
  };

  // Add menu item
  const addMenuItem = () => {
    if (newMenuItem.trim()) {
      const id = (menuForm.menuItems.length + 1).toString();
      setMenuForm({
        ...menuForm,
        menuItems: [...menuForm.menuItems, { id, label: newMenuItem.trim() }]
      });
      setNewMenuItem('');
    }
  };

  // Remove menu item
  const removeMenuItem = (id: string) => {
    setMenuForm({
      ...menuForm,
      menuItems: menuForm.menuItems.filter(item => item.id !== id)
    });
  };

  // Save menu
  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await eventsApi.updateEvent(menuForm.eventId, {
        drop_time: menuForm.drop_time,
        menu: menuForm.menuItems
      });
      alert('Menu saved successfully!');
      closeMenuForm();

      // Reload events
      const data = await eventsApi.getAllEvents();
      const eventsWithDetails = await Promise.all(
        data.map(async (event) => {
          const fullEvent = await eventsApi.getEventById(event.eventId);
          return {
            eventId: event.eventId,
            title: fullEvent?.title || '',
            date: fullEvent?.date || '',
            location: fullEvent?.location || '',
            event_type: fullEvent?.event_type || 'potluck',
            menu: fullEvent?.menu || [],
            drop_time: fullEvent?.drop_time,
            rsvp_deadline: fullEvent?.rsvp_deadline
          };
        })
      );
      setEvents(eventsWithDetails.filter((e): e is EventDisplay => e !== null));
    } catch (error) {
      console.error('Failed to save menu:', error);
      alert('Failed to save menu. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format deadline for display
  const formatDeadline = (deadline?: string) => {
    if (!deadline) return 'No deadline set';
    return new Date(deadline).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="host-dashboard">
        <div className="loading-container">
          <p>Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="host-dashboard">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <h1>Your Events</h1>
          <p className="dashboard-subtitle">Manage your events and menus</p>
        </header>

        {events.length === 0 ? (
          <div className="no-events">
            <p>No events yet. Create your first event!</p>
          </div>
        ) : (
          <div className="events-list">
            {events.map((event) => (
              <div key={event.eventId} className="event-card">
                <div className="event-info">
                  <div className="event-header">
                    <h3>{event.title}</h3>
                    <span className={`event-type-badge ${event.event_type}`}>
                      {event.event_type === 'potluck' ? '🍽 Potluck' : '🎂 Birthday'}
                    </span>
                  </div>
                  <p className="event-date">{formatDate(event.date)}</p>
                  <p className="event-location">{event.location}</p>
                  {event.rsvp_deadline && (
                    <p className="event-deadline">RSVP by: {formatDeadline(event.rsvp_deadline)}</p>
                  )}
                  {event.event_type === 'potluck' && (
                    <div className="menu-status">
                      {event.menu.length === 0 && (
                        <span className="incomplete-badge">Menu incomplete</span>
                      )}
                      {event.menu.length > 0 && (
                        <span className="complete-badge">{event.menu.length} items</span>
                      )}
                    </div>
                  )}
                </div>
                {event.event_type === 'potluck' && (
                  <button
                    className="manage-menu-button"
                    onClick={() => openMenuForm(event)}
                  >
                    {event.menu.length === 0 ? 'Add Menu' : 'Edit Menu'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Menu Form Modal */}
        {selectedEvent && (
          <div className="modal-overlay" onClick={closeMenuForm}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Menu for {selectedEvent.title}</h2>
              <button className="close-modal" onClick={closeMenuForm}>✕</button>

              <form onSubmit={handleSaveMenu}>
                <label htmlFor="menu-drop-time">Menu Drop Time</label>
                <input
                  id="menu-drop-time"
                  type="datetime-local"
                  value={menuForm.drop_time ? menuForm.drop_time.slice(0, 16) : ''}
                  onChange={(e) => setMenuForm({...menuForm, drop_time: new Date(e.target.value).toISOString()})}
                />

                <h3>Menu Items</h3>
                <div className="menu-input-row">
                  <input
                    type="text"
                    placeholder="Add menu item (e.g. Grilled Burgers)"
                    value={newMenuItem}
                    onChange={(e) => setNewMenuItem(e.target.value)}
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

                {menuForm.menuItems.length > 0 && (
                  <div className="menu-items-list">
                    {menuForm.menuItems.map((item) => (
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

                <div className="form-actions">
                  <button type="button" className="cancel-button" onClick={closeMenuForm}>
                    Cancel
                  </button>
                  <button type="submit" className="save-button" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Menu'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
