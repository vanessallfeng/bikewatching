// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoidmFuZXNzYWxmZW5nIiwiYSI6ImNtaHpwNDBlcjBjb2cyam9najdmMHdieTMifQ.cGOsnvL8OINWs416eljWLA';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18, // Maximum allowed zoom
});

// Wait for the map to load before adding data
map.on('load', async () => {
  // Boston bike lanes source
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  // Boston bike lanes layer
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

  // Cambridge bike lanes source
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://cambridgegis.github.io/gisdata/bike-lanes.geojson',
  });

  // Cambridge bike lanes layer
  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#ff69b4', // hot pink to match
      'line-width': 5,
      'line-opacity': 0.6,
    },
  });
});

// Check that Mapbox GL JS is loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);
