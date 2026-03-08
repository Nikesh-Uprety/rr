import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search } from "lucide-react";

// Fix generic map marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface LocationPickerProps {
  onLocationSelect: (location: string) => void;
  defaultLocation?: string; // Expecting string format: "lat,lng"
}

// Map Component to handle clicks
function LocationMarker({
  position,
  setPosition,
}: {
  position: L.LatLng | null;
  setPosition: (pos: L.LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : <Marker position={position}></Marker>;
}

export function LocationPicker({
  onLocationSelect,
  defaultLocation,
}: LocationPickerProps) {
  const [position, setPosition] = useState<L.LatLng | null>(
    defaultLocation
      ? L.latLng(
          parseFloat(defaultLocation.split(",")[0]),
          parseFloat(defaultLocation.split(",")[1])
        )
      : null
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapCenter, setMapCenter] = useState<L.LatLngExpression>([
    27.7172, 85.324, // Default to Kathmandu, Nepal
  ]);
  const [loading, setLoading] = useState(false);

  // When position changes, notify the parent
  useEffect(() => {
    if (position) {
      onLocationSelect(`${position.lat},${position.lng}`);
    }
  }, [position, onLocationSelect]);

  const getCurrentLocation = () => {
    setLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
          setPosition(latlng);
          setMapCenter([latlng.lat, latlng.lng]);
          setLoading(false);
        },
        (error) => {
          console.error("Error getting location: ", error);
          alert("Unable to get your location. Please select it manually.");
          setLoading(false);
        }
      );
    } else {
      alert("Geolocation is not supported by your browser");
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length > 2) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
          );
          const data = await response.json();
          setSuggestions(data || []);
          setShowSuggestions(true);
        } catch (error) {
          console.error("Search error", error);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSuggestion = (result: any) => {
    const newPos = L.latLng(parseFloat(result.lat), parseFloat(result.lon));
    setMapCenter([newPos.lat, newPos.lng]);
    setPosition(newPos);
    setSearchQuery(result.display_name);
    setShowSuggestions(false);
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        handleSelectSuggestion(data[0]);
      } else {
        alert("Location not found. Please try adjusting your search terms.");
      }
    } catch (error) {
      console.error("Search error", error);
      alert("Error searching for location");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={getCurrentLocation}
          className="flex gap-2 items-center flex-1"
          disabled={loading}
        >
          <MapPin size={16} />
          {loading ? "Getting location..." : "Use Current Location"}
        </Button>
      </div>
      
      <div className="flex gap-2 relative">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Search for an area, street, etc."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setShowSuggestions(false);
                handleSearch();
              }
            }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-md shadow-lg z-[1000] max-h-60 overflow-auto">
              {suggestions.map((result, i) => (
                <div
                  key={i}
                  className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-left transition-colors"
                  onClick={() => handleSelectSuggestion(result)}
                >
                  {result.display_name}
                </div>
              ))}
            </div>
          )}
        </div>
        <Button 
          type="button" 
          variant="secondary" 
          onClick={() => {
            setShowSuggestions(false);
            handleSearch();
          }}
          disabled={loading || !searchQuery}
        >
          <Search size={16} />
        </Button>
      </div>

      <div className="h-[300px] w-full rounded-md overflow-hidden border border-input mt-2">
        {/* We use a key to force re-render if mapCenter jumps by a huge distance to avoid weird animation, but typical react-leaflet usage can handle just updating center prop */}
        <MapContainer
          center={mapCenter}
          zoom={13}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={setPosition} />
        </MapContainer>
      </div>
      
      {position && (
        <p className="text-xs text-muted-foreground">
          Selected coordinates: {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
