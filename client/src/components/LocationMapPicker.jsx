import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import toast from 'react-hot-toast';
import { MapPin, Search, Navigation } from 'lucide-react';

// Standard Leaflet icon workaround for Vite/Webpack bundlers
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const LocationMapPicker = ({ onLocationSelected, initialLat, initialLng }) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [mapCenter, setMapCenter] = useState({ lat: 28.6139, lng: 77.2090 }); // Default Delhi

    // Reverse geocode lat/lng to get address info
    const reverseGeocode = async (lat, lon) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
            );
            const data = await response.json();
            if (data && data.address) {
                const addr = data.address;
                const roadName = addr.road || addr.street || addr.neighbourhood || '';
                const houseNum = addr.house_number || '';
                const fullAddress = [houseNum, roadName, addr.suburb, addr.village].filter(Boolean).join(', ') || data.display_name;
                const city = addr.city || addr.town || addr.county || addr.state_district || '';
                const village = addr.village || addr.hamlet || addr.suburb || '';
                const locality = addr.suburb || addr.neighbourhood || village || '';
                const pincode = addr.postcode || '';

                return {
                    latitude: lat.toFixed(6),
                    longitude: lon.toFixed(6),
                    fullAddress,
                    city,
                    village,
                    locality,
                    pincode
                };
            }
        } catch (err) {
            console.error('Reverse geocoding error:', err);
        }
        return {
            latitude: lat.toFixed(6),
            longitude: lon.toFixed(6),
            fullAddress: '',
            city: '',
            village: '',
            locality: '',
            pincode: ''
        };
    };

    // Forward geocode / search address
    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
            );
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                updateMapMarker(lat, lon, true);
            } else {
                toast.error('Location not found. Try searching with city or state.');
            }
        } catch (err) {
            toast.error('Search failed.');
        } finally {
            setLoading(false);
        }
    };

    // Capture User Live Location
    const handleLocateMe = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser.');
            return;
        }
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                updateMapMarker(latitude, longitude, true);
                setLoading(false);
            },
            (error) => {
                toast.error('Could not get live location. Try selecting manually.');
                setLoading(false);
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    };

    // Update Marker and call callback
    const updateMapMarker = async (lat, lon, centerMap = false) => {
        if (mapRef.current) {
            if (centerMap) {
                mapRef.current.setView([lat, lon], 14);
            }
            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lon]);
            } else {
                markerRef.current = L.marker([lat, lon], { draggable: true }).addTo(mapRef.current);
                markerRef.current.on('dragend', async (e) => {
                    const position = e.target.getLatLng();
                    await updateMapMarker(position.lat, position.lng, false);
                });
            }
            const info = await reverseGeocode(lat, lon);
            onLocationSelected(info);
        }
    };

    // Initialize Map
    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            const startLat = parseFloat(initialLat) || mapCenter.lat;
            const startLng = parseFloat(initialLng) || mapCenter.lng;

            // Initialize Map
            mapRef.current = L.map(mapContainerRef.current, {
                zoomControl: true,
                attributionControl: false
            }).setView([startLat, startLng], 12);

            // Add OpenStreetMap Tile Layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(mapRef.current);

            // Add marker
            markerRef.current = L.marker([startLat, startLng], { draggable: true }).addTo(mapRef.current);

            // Set up marker drag end handler
            markerRef.current.on('dragend', async (e) => {
                const position = e.target.getLatLng();
                await updateMapMarker(position.lat, position.lng, false);
            });

            // Map click handler to place marker
            mapRef.current.on('click', async (e) => {
                const { lat, lng } = e.latlng;
                await updateMapMarker(lat, lng, false);
            });

            // If we have initial values, geocode them, otherwise get user's current loc
            if (initialLat && initialLng) {
                updateMapMarker(parseFloat(initialLat), parseFloat(initialLng), true);
            } else {
                // Try locating the user initially
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        updateMapMarker(latitude, longitude, true);
                    },
                    () => {
                        // fallback to Delhi
                        updateMapMarker(mapCenter.lat, mapCenter.lng, true);
                    },
                    { enableHighAccuracy: false, timeout: 5000 }
                );
            }
        }

        // Cleanup on unmount
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
        };
    }, []);

    return (
        <div className="w-full space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
                <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400 h-4 w-4" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search city, town, or area..."
                            className="w-full pl-9 pr-4 py-2 border-2 border-orange-200 rounded-xl bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl text-sm transition-colors"
                    >
                        Search
                    </button>
                </form>
                <button
                    type="button"
                    onClick={handleLocateMe}
                    disabled={loading}
                    className="flex items-center justify-center gap-1 px-4 py-2 bg-orange-100 border-2 border-orange-200 hover:bg-orange-200 text-orange-700 font-semibold rounded-xl text-sm transition-colors"
                >
                    <Navigation className="h-4 w-4" />
                    Locate Me
                </button>
            </div>

            <div className="relative border-2 border-orange-200 rounded-2xl overflow-hidden bg-orange-50">
                <div 
                    ref={mapContainerRef} 
                    className="w-full h-[320px] z-10"
                />
                <div className="absolute bottom-2 left-2 z-[400] bg-white/95 px-3 py-1.5 rounded-lg text-[11px] text-orange-800 font-semibold shadow border border-orange-200 flex items-center gap-1.5 pointer-events-none">
                    <MapPin className="h-3.5 w-3.5 text-orange-500 fill-orange-500" />
                    <span>Click on the map or drag marker to adjust location</span>
                </div>
            </div>
        </div>
    );
};

export default LocationMapPicker;
