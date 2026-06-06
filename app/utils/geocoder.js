const geocodeAddress = async (address) => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address
    )}&limit=1`;
    
    // Add User-Agent header as required by Nominatim usage policy
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CareConnect Clinic Management System (contact@example.com)'
      }
    });

    if (!response.ok) {
      throw new Error("Failed to fetch from Geocoding API");
    }

    const data = await response.json();

    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    } else {
      console.warn(`Geocoding found no results for address: ${address}`);
      return null;
    }
  } catch (error) {
    console.error("Geocoding error:", error.message);
    return null;
  }
};

module.exports = { geocodeAddress };
