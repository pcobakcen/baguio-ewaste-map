import React, { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';

// --- DATA TYPES ---
interface Location {
  id: string;
  lat: number;
  lng: number;
  address: string;
  schedule: string;
  label: string;
}

interface ContactInfo {
  email: string;
  phone: string;
  office: string;
}

interface AppState {
    locations: Location[];
    announcements: string;
    contactInfo: ContactInfo;
}

// --- REDUCER ACTIONS ---
type AppAction =
  | { type: 'SET_STATE'; payload: AppState }
  | { type: 'ADD_LOCATION'; payload: Location }
  | { type: 'EDIT_LOCATION'; payload: Location }
  | { type: 'DELETE_LOCATION'; payload: string } // payload is id
  | { type: 'SET_ANNOUNCEMENTS'; payload: string }
  | { type: 'SET_CONTACT_INFO'; payload: ContactInfo };


// --- MOCK/DEFAULT DATA ---
const initialAppState: AppState = {
    locations: [],
    announcements: 'No announcements have been posted yet.',
    contactInfo: {
        email: 'contact@baguio-ewaste.gov.ph',
        phone: '(074) 123-4567',
        office: 'City Environment and Parks Management Office (CEPMO), Baguio City Hall',
    }
};


// --- LEAFLET ICON SETUP ---
const eWasteIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzJFN0QzMiI+PHBhdGggZD0iTTYgMTljMCAxLjEuOSAyIDIgMmg4YzEuMSAwIDItLjkgMi0yVjdINnYxMnpNMTkgNGgtMy41bC0xLTFoLTVsLTEgMUg1djJoMTRWNHoiLz48L3N2Zz4=',
    iconSize: [20, 20],
    iconAnchor: [10, 20],
    popupAnchor: [0, -20],
});

const newLocationIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZGQzEwNyI+PHBhdGggZD0iTTEyIDJDOC4xMyAyIDUgNS4xMyA1IDljMCA1LjI1IDcgMTMgNyAxM3M3LTcuNzUgNy0xM2MwLTMuODctMy4xMy03LTctN3ptMCA5LjVjLTEuMzggMC0yLjUtMS4xMi0yLjUtMi41czEuMTItMi41IDIuNS0yLjUgMi41IDEuMTIgMi41IDIuNS0xLjEyIDIuNS0yLjUgMi41eiIvPjwvc3ZnPg==',
    iconSize: [20, 20],
    iconAnchor: [10, 20],
    popupAnchor: [0, -20],
});

// --- STATE MANAGEMENT REDUCER ---
const appReducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case 'SET_STATE':
            return action.payload;
        case 'ADD_LOCATION':
            return { ...state, locations: [...state.locations, action.payload] };
        case 'EDIT_LOCATION':
            return {
                ...state,
                locations: state.locations.map(loc =>
                    loc.id === action.payload.id ? action.payload : loc
                ),
            };
        case 'DELETE_LOCATION': {
            const newLocations = state.locations.filter(loc => loc.id !== action.payload);
            return {
                ...state,
                locations: newLocations,
            };
        }
        case 'SET_ANNOUNCEMENTS':
            return { ...state, announcements: action.payload };
        case 'SET_CONTACT_INFO':
            return { ...state, contactInfo: action.payload };
        default:
            return state;
    }
};

// --- COMPONENTS ---

// --- Confirmation Modal ---
interface ConfirmationModalProps {
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-content">
                <p>{message}</p>
                <div className="modal-actions">
                    <button onClick={onConfirm} className="btn btn-danger">Delete</button>
                    <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
                </div>
            </div>
        </div>
    );
};


// --- Map View ---
interface MapViewProps {
  locations: Location[];
}

const MapView: React.FC<MapViewProps> = ({ locations }) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, {
          zoomSnap: 0.1,
          zoomDelta: 0.25
      }).setView([16.4023, 120.5960], 13);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      setTimeout(() => map.invalidateSize(), 0);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); 
  
  useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      map.eachLayer((layer) => {
          if (layer instanceof L.Marker) {
              map.removeLayer(layer);
          }
      });
      
      const directions: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];
      const offsets: Record<typeof directions[number], [number, number]> = {
          top: [0, -22],
          bottom: [0, 5],
          right: [12, -10],
          left: [-12, -10]
      };

      locations.forEach((loc, index) => {
          const direction = directions[index % directions.length];
          const marker = L.marker([loc.lat, loc.lng], { icon: eWasteIcon }).addTo(map);
          const popupContent = `
              <h4>${loc.address}</h4>
              <p><strong>Schedule:</strong> ${loc.schedule}</p>
          `;
          marker.bindPopup(popupContent);
          marker.bindTooltip(loc.label, {
              permanent: true,
              direction: direction,
              offset: offsets[direction],
              className: 'location-label'
          });
      });

  }, [locations]);

  return <div ref={mapContainerRef} className="map-container" aria-label="Map of E-Waste drop-off locations"></div>;
};


// --- Pages ---
const AnnouncementsPage: React.FC<{announcements: string}> = ({ announcements }) => {
    return (
        <div className="page">
            <h2>Announcements</h2>
            <p style={{whiteSpace: 'pre-wrap'}}>{announcements}</p>
        </div>
    );
};

const ContactPage: React.FC<{contactInfo: ContactInfo}> = ({ contactInfo }) => {
    return (
        <div className="page">
            <h2>Contact Us</h2>
            <p>For inquiries about the E-Waste Collection Program in Baguio City, please reach out through the following channels:</p>
            <ul>
                <li><strong>Email:</strong> {contactInfo.email}</li>
                <li><strong>Phone:</strong> {contactInfo.phone}</li>
                <li><strong>Office:</strong> {contactInfo.office}</li>
            </ul>
        </div>
    );
};

// --- Login Page ---
interface LoginPageProps {
    onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'Netlify#123') {
            setError('');
            onLoginSuccess();
        } else {
            setError('Incorrect password. Please try again.');
        }
    };

    return (
        <div className="page login-page-container">
            <form onSubmit={handleSubmit} className="form-container" style={{maxWidth: '400px'}}>
                <h2>Admin Login</h2>
                <div className="input-group">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        className="form-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        aria-describedby={error ? 'password-error' : undefined}
                    />
                </div>
                {error && <p id="password-error" className="error-message">{error}</p>}
                <div className="form-buttons">
                    <button type="submit" className="btn btn-primary">Login</button>
                </div>
            </form>
        </div>
    );
};

// --- Admin Page ---
interface AdminPageProps {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
}

const AdminPage: React.FC<AdminPageProps> = ({ state, dispatch }) => {
    const { locations, announcements, contactInfo } = state;

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);
    const [formState, setFormState] = useState({ address: '', schedule: '', lat: '', lng: '', label: '' });
    const [announcementText, setAnnouncementText] = useState(announcements);
    const [contactForm, setContactForm] = useState(contactInfo);
    const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, locationId: '' });


    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const newLocationMarkerRef = useRef<L.Marker | null>(null);
    const existingMarkersRef = useRef<L.Marker[]>([]);

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            const map = L.map(mapContainerRef.current, {
                zoomSnap: 0.1,
                zoomDelta: 0.25
            }).setView([16.4023, 120.5960], 13);
            mapRef.current = map;
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
            setTimeout(() => map.invalidateSize(), 0);
        }
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
  
      const handleClick = (e: L.LeafletMouseEvent) => {
        if (isFormOpen && !editingLocation) {
          setFormState(prev => ({
            ...prev,
            lat: e.latlng.lat.toString(),
            lng: e.latlng.lng.toString(),
          }));
        }
      };
  
      map.on('click', handleClick);
      return () => {
        map.off('click', handleClick);
      };
    }, [mapRef, isFormOpen, editingLocation]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        existingMarkersRef.current.forEach(marker => map.removeLayer(marker));
        existingMarkersRef.current = [];

        const directions: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];
        const offsets: Record<typeof directions[number], [number, number]> = {
            top: [0, -22],
            bottom: [0, 5],
            right: [12, -10],
            left: [-12, -10]
        };

        locations.forEach((loc, index) => {
            const direction = directions[index % directions.length];
            const marker = L.marker([loc.lat, loc.lng], { icon: eWasteIcon }).addTo(map);
            marker.bindPopup(`<h4>${loc.address}</h4><p><strong>Schedule:</strong> ${loc.schedule}</p>`);
            marker.bindTooltip(loc.label, {
                permanent: true,
                direction: direction,
                offset: offsets[direction],
                className: 'location-label'
            });
            existingMarkersRef.current.push(marker);
        });

    }, [locations]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (newLocationMarkerRef.current) {
            map.removeLayer(newLocationMarkerRef.current);
            newLocationMarkerRef.current = null;
        }

        if (!isFormOpen) return;

        const lat = parseFloat(formState.lat);
        const lng = parseFloat(formState.lng);

        if (!isNaN(lat) && !isNaN(lng)) {
            const marker = L.marker([lat, lng], { icon: newLocationIcon, draggable: true }).addTo(map);
            marker.on('dragend', (e) => {
                const newCoords = e.target.getLatLng();
                setFormState(prev => ({ ...prev, lat: newCoords.lat.toString(), lng: newCoords.lng.toString() }));
            });
            newLocationMarkerRef.current = marker;
            map.setView([lat, lng], Math.max(map.getZoom(), 15));
        }
    }, [isFormOpen, formState.lat, formState.lng, mapRef]);
    
    const handleAddNewClick = () => {
        setEditingLocation(null);
        setFormState({ address: '', schedule: '', lat: '', lng: '', label: '' });
        setIsFormOpen(true);
    };

    const handleStartEdit = (location: Location) => {
        setEditingLocation(location);
        setFormState({
            address: location.address,
            schedule: location.schedule,
            lat: location.lat.toString(),
            lng: location.lng.toString(),
            label: location.label,
        });
        setIsFormOpen(true);
    };
    
    const handleCancel = () => {
        setIsFormOpen(false);
        setEditingLocation(null);
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const lat = parseFloat(formState.lat);
        const lng = parseFloat(formState.lng);

        if (isNaN(lat) || isNaN(lng) || !formState.address || !formState.label) {
            alert('Please provide a valid address, label, and coordinates.');
            return;
        }

        if (editingLocation) {
            const updatedLocation: Location = {
                ...editingLocation,
                lat,
                lng,
                address: formState.address,
                schedule: formState.schedule,
                label: formState.label,
            };
            dispatch({ type: 'EDIT_LOCATION', payload: updatedLocation });
        } else {
            const newLocation: Location = {
                id: crypto.randomUUID(),
                lat,
                lng,
                address: formState.address,
                schedule: formState.schedule,
                label: formState.label,
            };
            dispatch({ type: 'ADD_LOCATION', payload: newLocation });
        }
        handleCancel();
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmModalState({ isOpen: true, locationId: id });
    };
    
    const handleConfirmDelete = () => {
        if (confirmModalState.locationId) {
            dispatch({ type: 'DELETE_LOCATION', payload: confirmModalState.locationId });
            if (editingLocation?.id === confirmModalState.locationId) {
                handleCancel();
            }
        }
        setConfirmModalState({ isOpen: false, locationId: '' });
    };

    const handleCancelDelete = () => {
        setConfirmModalState({ isOpen: false, locationId: '' });
    };


    const handleSaveAnnouncements = () => {
        dispatch({ type: 'SET_ANNOUNCEMENTS', payload: announcementText });
        alert('Announcements saved!');
    };
    
    const handleSaveContactInfo = () => {
        dispatch({ type: 'SET_CONTACT_INFO', payload: contactForm });
        alert('Contact information saved!');
    };

    return (
        <div className="page admin-page">
            <ConfirmationModal
                isOpen={confirmModalState.isOpen}
                message="Are you sure you want to delete this location? This action cannot be undone."
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />

            <h1>Admin Panel</h1>
            
            <div className="admin-section">
                <h2>Manage Drop-off Locations</h2>
                <div ref={mapContainerRef} className="map-container"></div>
                
                {isFormOpen && (
                    <form onSubmit={handleFormSubmit} className="form-container">
                        <h3>{editingLocation ? 'Edit Location' : 'Add New Location'}</h3>
                         <div className="input-group">
                            <label htmlFor="address">Address</label>
                            <input
                                id="address"
                                type="text"
                                className="form-input"
                                value={formState.address}
                                onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                                placeholder="e.g., SM City Baguio"
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="label">Map Label</label>
                            <input
                                id="label"
                                type="text"
                                className="form-input"
                                value={formState.label}
                                onChange={(e) => setFormState({ ...formState, label: e.target.value })}
                                placeholder="e.g., SM"
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="schedule">Schedule</label>
                            <input
                                id="schedule"
                                type="text"
                                className="form-input"
                                value={formState.schedule}
                                onChange={(e) => setFormState({ ...formState, schedule: e.target.value })}
                                placeholder="e.g., Mon-Fri, 9am - 5pm"
                                required
                            />
                        </div>
                        <div style={{display: 'flex', gap: '1rem'}}>
                            <div className="input-group" style={{flex: 1}}>
                                <label htmlFor="lat">Latitude</label>
                                <input
                                    id="lat"
                                    type="number"
                                    step="any"
                                    className="form-input"
                                    value={formState.lat}
                                    onChange={(e) => setFormState({ ...formState, lat: e.target.value })}
                                    placeholder="e.g., 16.4023"
                                    required
                                />
                            </div>
                            <div className="input-group" style={{flex: 1}}>
                                <label htmlFor="lng">Longitude</label>
                                <input
                                    id="lng"
                                    type="number"
                                    step="any"
                                    className="form-input"
                                    value={formState.lng}
                                    onChange={(e) => setFormState({ ...formState, lng: e.target.value })}
                                    placeholder="e.g., 120.5960"
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-buttons">
                            <button type="submit" className="btn btn-primary">
                                {editingLocation ? 'Update Location' : 'Add Location'}
                            </button>
                            <button type="button" onClick={handleCancel} className="btn btn-secondary">
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                <div className="location-list">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                        <h3>Existing Locations</h3>
                        {!isFormOpen && <button onClick={handleAddNewClick} className="btn btn-primary">Add New Location</button>}
                    </div>
                    {locations.length > 0 ? (
                        <ul>
                            {locations.map(loc => (
                                <li key={loc.id} className="location-item">
                                    <span><strong>{loc.address}</strong> ({loc.schedule})</span>
                                    <div className="location-actions">
                                        <button onClick={() => handleStartEdit(loc)} className="btn-secondary-small">Edit</button>
                                        <button onClick={(e) => handleDeleteClick(e, loc.id)} className="btn-danger-small">Delete</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : <p>No locations added yet.</p>}
                </div>
            </div>

            <div className="admin-section">
                <h2>Edit Announcements</h2>
                <textarea 
                    className="form-textarea"
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                />
                <button onClick={handleSaveAnnouncements} className="btn btn-primary" style={{marginTop: '1rem'}}>Save Announcements</button>
            </div>
            
            <div className="admin-section">
                <h2>Edit Contact Information</h2>
                 <form className="form-container" style={{padding: 0, background: 'none', margin: 0}}>
                    <div className="input-group">
                        <label htmlFor="contact-email">Email</label>
                        <input
                            id="contact-email"
                            type="email"
                            className="form-input"
                            value={contactForm.email}
                            onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="contact-phone">Phone</label>
                        <input
                            id="contact-phone"
                            type="text"
                            className="form-input"
                            value={contactForm.phone}
                            onChange={(e) => setContactForm({...contactForm, phone: e.target.value})}
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="contact-office">Office Address</label>
                        <input
                            id="contact-office"
                            type="text"
                            className="form-input"
                            value={contactForm.office}
                            onChange={(e) => setContactForm({...contactForm, office: e.target.value})}
                        />
                    </div>
                    <button type="button" onClick={handleSaveContactInfo} className="btn btn-primary" style={{marginTop: '1rem'}}>Save Contact Info</button>
                </form>
            </div>
        </div>
    );
};


// --- App ---
const App: React.FC = () => {
  const [page, setPage] = useState(window.location.hash.substring(1) || '/');
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('isAuthenticated') === 'true');
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const STORAGE_KEY = 'e-waste-data';

  // Effect to load state from localStorage on initial mount
  useEffect(() => {
    try {
      const storedItem = window.localStorage.getItem(STORAGE_KEY);
      if (storedItem) {
        const savedState = JSON.parse(storedItem);
        dispatch({ type: 'SET_STATE', payload: savedState });
      }
    } catch (error) {
      console.error(`Error reading localStorage key “${STORAGE_KEY}”:`, error);
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to save state to localStorage whenever it changes
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error(`Error setting localStorage key “${STORAGE_KEY}”:`, error);
    }
  }, [state]); // This runs on initial render AND every time `state` changes

  // Effect to synchronize state across browser tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const savedState = JSON.parse(event.newValue);
          dispatch({ type: 'SET_STATE', payload: savedState });
        } catch (error) {
          console.error('Error synchronizing state from localStorage:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []); // The empty dependency array ensures this effect runs only once.

  useEffect(() => {
    const handleHashChange = () => {
      setPage(window.location.hash.substring(1) || '/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault();
    window.location.hash = path;
    setIsMenuOpen(false);
  }, []);
  
  const handleLogout = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    sessionStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
    window.location.hash = '/';
    setIsMenuOpen(false);
  };

  const handleLoginSuccess = () => {
      sessionStorage.setItem('isAuthenticated', 'true');
      setIsAuthenticated(true);
      window.location.hash = '/admin';
  };

  const renderPage = () => {
    const effectivePage = page || '/';

    if (effectivePage === '/admin' && !isAuthenticated) {
        window.location.hash = '/login';
        return null;
    }
    
    switch (effectivePage) {
      case '/announcements':
        return <AnnouncementsPage announcements={state.announcements} />;
      case '/contact':
        return <ContactPage contactInfo={state.contactInfo} />;
      case '/login':
        return <LoginPage onLoginSuccess={handleLoginSuccess} />;
      case '/admin':
        return <AdminPage state={state} dispatch={dispatch} />;
      case '/':
      default:
        return (
          <div className="page">
            <h2>E-Waste Drop-off Points</h2>
            <p>View drop-off locations on the map. If none are visible, it means no locations have been added yet.</p>
            <MapView locations={state.locations} />
          </div>
        );
    }
  };

  return (
    <>
        <header className="app-header">
            <div className="app-title">Baguio E-Waste Map</div>
            <button className="hamburger-menu" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu" aria-expanded={isMenuOpen}>☰</button>
            <nav className={`nav-menu ${isMenuOpen ? 'open' : ''}`} onMouseLeave={() => setIsMenuOpen(false)}>
                <a href="#/" onClick={(e) => navigate(e, '/')} className={`nav-link ${(page ==='/' || page === '') ? 'active' : ''}`}>Map</a>
                <a href="#/announcements" onClick={(e) => navigate(e, '/announcements')} className={`nav-link ${page ==='/announcements' ? 'active' : ''}`}>Announcements</a>
                <a href="#/contact" onClick={(e) => navigate(e, '/contact')} className={`nav-link ${page ==='/contact' ? 'active' : ''}`}>Contact</a>
                {isAuthenticated ? (
                  <>
                    <a href="#/admin" onClick={(e) => navigate(e, '/admin')} className={`nav-link ${page === '/admin' ? 'active' : ''}`}>Admin</a>
                    <a href="#/" onClick={handleLogout} className="nav-link">Logout</a>
                  </>
                ) : (
                  <a href="#/login" onClick={(e) => navigate(e, '/login')} className={`nav-link ${page === '/login' ? 'active' : ''}`}>Login</a>
                )}
            </nav>
        </header>
        <main className="main-content">
            {renderPage()}
        </main>
    </>
  );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}