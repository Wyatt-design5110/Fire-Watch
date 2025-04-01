// Function to return the number of active alerts of the given type
async function getAlertCounts() {
    // Object to store the counts of each alert type
    let alertCounts = {
        "Fire Warning": 0,
        "Fire Weather Watch": 0,
        "Red Flag Warning": 0
    };

    // List of alert types and their corresponding API calls
    const alertTypes = [
        { event: "Fire Warning", id: "fireWarningCount" },
        { event: "Fire Weather Watch", id: "fireWeatherWatchCount" },
        { event: "Red Flag Warning", id: "redFlagWarningCount" }
    ];

    // Fetch alerts for each type
    for (let alertType of alertTypes) {
        try {
            const response = await fetch(`https://api.weather.gov/alerts/active?event=${encodeURIComponent(alertType.event)}&status=actual`);
            const data = await response.json();
            alertCounts[alertType.event] = data.features.length; // Count the number of alerts

            // Update the webpage with the alert count
            document.getElementById(alertType.id).innerText = data.features.length;
        } catch (error) {
            console.error(`Error fetching ${alertType.event} alerts:`, error);
        }
    }
}


// Function to return the most recent VIIRS detection time
function getTime(d) {

    // Create new Date object with the given time
    let now = new Date(d);

    // Format current UTC time as yyyy-mm-ddThh:mm:ss
    let iso = now.toISOString();

    // Split current time into iso[0]=yyyy-mm-dd and iso[1]=hh:mm:ss
    iso = iso.split("T");

    let date = iso[0];
    let time = "00:00:00";

    // If the current time is 12:00:00 or later, set time to 12:00:00
    if (iso[1].slice(0,2) >= 12) {
        time = "12:00:00";
    }
    else {
        // If current time is before 12:00:00, set time to 00:00:00
        time = "00:00:00";
    } 

    return date + "T" + time;
}


// Function to fetch and display NWS alerts
async function fetchAndDisplayAlerts(eventType, color) {
    try {
        // Fetch alerts of the given eventType where status=actual (to exclude test alerts)
        const response = await fetch(`https://api.weather.gov/alerts/active?event=${encodeURIComponent(eventType)}&status=actual`);
        const data = await response.json();

        for (let alert of data.features) {
            // Case 1: Alert contains direct geometry (polygon)
            if (alert.geometry && alert.geometry.type === "Polygon") {
                
                // Create an array of [latitude,longitude] pairs that represent the alert perimeter
                let coords = alert.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                
                L.polygon(coords, { color: color, fillOpacity: 0.4 }).addTo(map)
                    .bindPopup(`<b>${alert.properties.event}</b>
                                <br><p>${alert.properties.headline}</p>
                                <details><summary></summary>
                                <p>${alert.properties.description.replaceAll("*","<br><br>*")}
                                </p></details>`);           
            } 
            // Case 2: Alert provides affectedZones (UGC geocode) instead of geometry
            else if (alert.properties.affectedZones) {
                for (let zoneURL of alert.properties.affectedZones) {
                    try {
                        // Fetch the coordinates of the given affectedZone
                        let zoneResponse = await fetch(zoneURL);
                        let zoneData = await zoneResponse.json();

                        if (zoneData.geometry && zoneData.geometry.type === "Polygon") {
                            
                            // Create an array of [latitude,longitude] pairs that represent the zone perimeter
                            let zoneCoords = zoneData.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                            
                            // Add the polygon to the map
                            L.polygon(zoneCoords, { color: color, fillOpacity: 0.4 }).addTo(map)
                                .bindPopup(`<b>${alert.properties.event}</b>
                                    <br><p>${alert.properties.headline}</p>
                                    <details><summary></summary>
                                    <p>${alert.properties.description.replaceAll("*","<br><br>*")}
                                    </p></details>`); 
                        }
                    } catch (error) {
                        console.error("Error fetching zone data:", error);
                    }
                }
            }
            else {
                console.error(`Error fetching ${alert.properties.id}`);
            }
        }
    } catch (error) {
        console.error(`Error fetching ${eventType} alerts:`, error);
    }
}


// Function to fetch and display active fires from FireNRT API
async function fetchAndDisplayFires(color, now) {
    try {
        const response = await fetch(`https://firenrt.delta-backend.com/collections/public.eis_fire_lf_perimeter_nrt/items?region=CONUS&limit=9999&t=${encodeURIComponent(getTime(now))}&f=geojson`);
        const fireData = await response.json();

        // Get the number of items returned
        let numMatched = fireData.features.length;

        for (let firePerimeter of fireData.features) {
            if (firePerimeter.geometry) {
                
                // Create an array of [latitude,longitude] pairs that represent the fire perimeter
                let coords = firePerimeter.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                
                let t = firePerimeter.properties.t.split("T");
                let detDate = t[0];
                let detTime = t[1];

                // Add the polygon to the map
                L.polygon(coords, { color: color, fillOpacity: 0.1 }).addTo(map)
                    .bindPopup(`<b>Fire ID: ${firePerimeter.properties.fireid}</b>
                                <br>Duration: ${firePerimeter.properties.duration} days
                                <br>Fire area: ${firePerimeter.properties.farea} km^2
                                <br>Detection date: ${detDate}
                                <br>Detection time: ${detTime} UTC`);            
            }
            else {
                console.error(`Error fetching ${firePerimeter.id}`);
            }
        }

        // If the VIIRS detections are late to post (ie, none were returned) get the detections from 12h ago
        if (numMatched == 0) {
            // Subtract 12 hours from current time and retry
            fetchAndDisplayFires("red", now.setHours(now.getHours() - 12));
        }
  
    } catch (error) {
        console.error("Error fetching fire data:", error);
    }
}


// Function to get user location
function getUserLocation() {
        document.getElementById('geolocate-btn').addEventListener('click', function () {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(function (position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                map.setView([lat, lon], 13);
                L.marker([lat, lon]).addTo(map)
                    .bindPopup("You are here.")
                    .openPopup();
            }, function (error) {
                alert("Location error: " + error.message);
            });
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    });
}
