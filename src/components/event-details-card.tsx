import React from 'react';

interface MenuItem {
  id: string;
  label: string;
}

interface EventDetailsCardProps {
  title: string;
  date: string;
  location: string;
  drop_time: string;
  menuItems: MenuItem[];
  magicLink: string;
  onCopyLink: () => void;
  onCreateAnother: () => void;
}

export const EventDetailsCard: React.FC<EventDetailsCardProps> = ({
  title,
  date,
  location,
  drop_time,
  menuItems,
  magicLink,
  onCopyLink,
  onCreateAnother,
}) => {
  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="event-details-container">
      {/* Success Banner */}
      <div className="success-banner">
        <div className="success-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
              fill="currentColor"
            />
          </svg>
        </div>
        <h2>Event Created Successfully!</h2>
        <p>Your potluck event is ready. Share the magic link with your guests.</p>
      </div>

      {/* Magic Link Section */}
      <div className="magic-link-section">
        <h3 className="magic-link-highlight">Guest Magic Link</h3>
        <div className="magic-link-wrapper">
          <div className="magic-link-display">{magicLink}</div>
          <button onClick={onCopyLink} className="copy-icon-button" title="Copy Link">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1Z"
                fill="currentColor"
              />
              <path
                d="M15 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H15C16.1 23 17 22.1 17 21V7C17 5.9 16.1 5 15 5ZM15 21H8V7H15V21Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <p className="link-helper-text">
          Guests can use this link to RSVP and claim menu items
        </p>
      </div>

      {/* Event Details Section */}
      <div className="event-details-section">
        <h3>Event Details</h3>
        <div className="details-grid">
          <div className="detail-item">
            <div className="detail-label">Event Title</div>
            <div className="detail-value">{title}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Date & Time</div>
            <div className="detail-value">{formatDateTime(date)}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Location</div>
            <div className="detail-value">{location}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Menu Drop Time</div>
            <div className="detail-value">{formatDateTime(drop_time)}</div>
          </div>
        </div>

        {/* Menu Items Preview */}
        {menuItems.length > 0 && (
          <div className="menu-items-preview">
            <h4>Menu Items ({menuItems.length})</h4>
            <div className="menu-items-list">
              {menuItems.map((item, index) => (
                <div key={item.id} className="menu-item-chip">
                  <span className="item-number">{index + 1}</span>
                  <span className="item-label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button onClick={onCreateAnother} className="create-another-button">
          Create Another Event
        </button>
      </div>
    </div>
  );
};
