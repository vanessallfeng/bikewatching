// Import D3 as an ES module
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

// URL for Bluebikes stations JSON
const INPUT_BLUEBIKES_CSV_URL =
  'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';

// Set your Mapbox access token here
mapboxgl.accessToken =
  'pk.eyJ1IjoidmFuZXNzYWxmZW5nIiwiYSI6ImNtaHpwNDBlcjBjb2cyam9najdmMHdieTMifQ.cGOsnvL8OINWs416eljWLA';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18, // Maximum allowed zoom
});

// Select the SVG element inside the map container
const svg = d3.select('#map').select('svg');

// Helper: convert station lat/lon to pixel coords using map.project()
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

// Wait for the map to load before adding data and markers
map.on('load', async () => {
  // --- Boston bike lanes source + layer ---
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': '#ff69b4', // hot pink
      'line-width': 5,
      'line-opacity': 0.6,
    },
  });

  // --- Cambridge bike lanes source + layer ---
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://cambridgegis.github.io/gisdata/bike-lanes.geojson',
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#ff69b4', // hot pink
      'line-width': 5,
      'line-opacity': 0.6,
    },
  });

  // --- Step 3.1: Fetch Bluebikes stations JSON with D3 ---
  let jsonData;
  try {
    const jsonUrl = INPUT_BLUEBIKES_CSV_URL;

    // Await JSON fetch
    jsonData = await d3.json(jsonUrl);

    console.log('Loaded JSON Data:', jsonData); // Log to verify structure
  } catch (error) {
    console.error('Error loading JSON:', error); // Handle errors
    return; // stop if we couldn't load data
  }

  // Get the stations array from the JSON
  const stations = jsonData.data.stations;
  console.log('Stations Array:', stations);

  // --- Step 3.3: Add station markers as SVG circles ---

  // Append circles to the SVG for each station
  const circles = svg
    .selectAll('circle')
    .data(stations)
    .enter()
    .append('circle')
    .attr('r', 5) // Radius of the circle
    .attr('fill', 'steelblue') // Circle fill color
    .attr('stroke', 'white') // Circle border color
    .attr('stroke-width', 1) // Circle border thickness
    .attr('opacity', 0.8); // Circle opacity

  // Function to update circle positions when the map moves/zooms
  function updatePositions() {
    circles
      .attr('cx', d => getCoords(d).cx) // Set x-position
      .attr('cy', d => getCoords(d).cy); // Set y-position
  }

  // Initial position update when map loads
  updatePositions();

  // Reposition markers on map interactions
  map.on('move', updatePositions); // Update during map movement
  map.on('zoom', updatePositions); // Update during zooming
  map.on('resize', updatePositions); // Update on window resize
  map.on('moveend', updatePositions); // Final adjustment after movement ends
});

// Check that Mapbox GL JS is loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);
