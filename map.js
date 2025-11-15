// Import D3 as an ES module
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Import Mapbox as an ES module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

// URL for Bluebikes stations JSON
const INPUT_BLUEBIKES_STATIONS_URL =
  'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';

// URL for Bluebikes trip CSV (March 2024)
const INPUT_BLUEBIKES_TRIPS_URL =
  'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';

// Set your Mapbox access token here
mapboxgl.accessToken =
  'pk.eyJ1IjoidmFuZXNzYWxmZW5nIiwiYSI6ImNtaHpwNDBlcjBjb2cyam9najdmMHdieTMifQ.cGOsnvL8OINWs416eljWLA';

// ---------- Global state ----------

// Base data
let stations = []; // station metadata from JSON
let trips = []; // all trips from CSV (with Date objects)

// Visualization state
let timeFilter = -1; // minutes since midnight; -1 = "any time"
let radiusScale; // size scale
let circles; // D3 selection of circles

// Color scale for departure ratio (0..1 -> 0, 0.5, 1)
const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

// Mapbox map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

// SVG overlay
const svg = d3.select('#map').select('svg');

// ---------- Helper functions ----------

// Convert station lat/lon to pixel coordinates on the current map view
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

// Minutes since midnight from a Date
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Filter trips to those that start or end within 60 minutes of timeFilter
function filterTripsByTime(allTrips, timeFilter) {
  if (timeFilter === -1) return allTrips;

  return allTrips.filter(trip => {
    const start = minutesSinceMidnight(trip.started_at);
    const end = minutesSinceMidnight(trip.ended_at);
    return (
      Math.abs(start - timeFilter) <= 60 ||
      Math.abs(end - timeFilter) <= 60
    );
  });
}

// Compute arrivals/departures/totalTraffic for each station,
// given a subset of trips.
function computeStationTraffic(stations, tripsSubset) {
  const departures = d3.rollup(
    tripsSubset,
    v => v.length,
    d => d.start_station_id
  );

  const arrivals = d3.rollup(
    tripsSubset,
    v => v.length,
    d => d.end_station_id
  );

  return stations.map(station => {
    const id = station.short_name;
    const arrivalsCount = arrivals.get(id) ?? 0;
    const departuresCount = departures.get(id) ?? 0;

    return {
      ...station,
      arrivals: arrivalsCount,
      departures: departuresCount,
      totalTraffic: arrivalsCount + departuresCount,
    };
  });
}

// Update circle positions to match the current map view
function updatePositions() {
  svg
    .selectAll('circle')
    .attr('cx', d => getCoords(d).cx)
    .attr('cy', d => getCoords(d).cy);
}

// ---------- Time slider wiring ----------

const timeSlider = document.getElementById('time-slider');
const selectedTimeEl = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

// Format minutes since midnight as something like "9:30 PM"
function formatTime(minutes) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setMinutes(minutes);
  return date.toLocaleTimeString('en-US', { timeStyle: 'short' });
}

// Update the label + trigger re-filtering
function updateTimeDisplay() {
  if (!timeSlider) return;

  timeFilter = Number(timeSlider.value);

  if (timeFilter === -1) {
    // No filter
    selectedTimeEl.textContent = '';
    anyTimeLabel.style.display = 'inline';
  } else {
    selectedTimeEl.textContent = formatTime(timeFilter);
    anyTimeLabel.style.display = 'none';
  }

  // If data hasn't loaded yet, do nothing
  if (!stations.length || !trips.length) return;

  updateScatterPlot(timeFilter);
}

if (timeSlider) {
  timeSlider.addEventListener('input', updateTimeDisplay);
}

// ---------- Core visualization update ----------

function updateScatterPlot(timeFilterValue) {
  // Filter trips by time
  const filteredTrips = filterTripsByTime(trips, timeFilterValue);

  // Recompute station traffic
  const stationsWithTraffic = computeStationTraffic(stations, filteredTrips);

  // Set radius scale domain & range
  const maxTraffic = d3.max(stationsWithTraffic, d => d.totalTraffic) || 1;

  if (!radiusScale) {
    radiusScale = d3
      .scaleSqrt()
      .domain([0, maxTraffic])
      .range([0, 25]);
  } else {
    radiusScale.domain([0, maxTraffic]);
  }

  // Change radius range when filtering to keep circles visible
  radiusScale.range(
    timeFilterValue === -1
      ? [0, 25] // default
      : [3, 50] // bigger when fewer stations have traffic
  );

  // JOIN stations to circles using key = short_name
  circles = svg
    .selectAll('circle')
    .data(stationsWithTraffic, d => d.short_name);

  // ENTER new circles
  const circlesEnter = circles
    .enter()
    .append('circle')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('fill-opacity', 0.6);

  // MERGE + update shared attributes
  const circlesMerged = circlesEnter.merge(circles);

  circlesMerged
    .attr('r', d => radiusScale(d.totalTraffic))
    // Step 6.1: set CSS variable for departure ratio
    .style('--departure-ratio', d => {
      if (!d.totalTraffic) return stationFlow(0.5); // neutral if no traffic
      const ratio = d.departures / d.totalTraffic;
      return stationFlow(ratio);
    });

  // Tooltips (update every time)
  circlesMerged.select('title').remove();
  circlesMerged.each(function (d) {
    d3.select(this)
      .append('title')
      .text(
        `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
      );
  });

  // Remove EXIT circles
  circles.exit().remove();

  // After radii / data update, fix positions
  updatePositions();
}

// ---------- Map setup + data loading ----------

map.on('load', async () => {
  // Bike lane sources/layers (Boston + Cambridge)
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
      'line-width': 3,
      'line-opacity': 0.6,
    },
  });

  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://cambridgegis.github.io/gisdata/bike-lanes.geojson',
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#ff69b4',
      'line-width': 3,
      'line-opacity': 0.6,
    },
  });

  // Load stations JSON
  let jsonData;
  try {
    jsonData = await d3.json(INPUT_BLUEBIKES_STATIONS_URL);
    stations = jsonData.data.stations;
    console.log('Stations loaded:', stations.length);
  } catch (error) {
    console.error('Error loading station JSON:', error);
    return;
  }

  // Load trips CSV + parse dates
  try {
    trips = await d3.csv(INPUT_BLUEBIKES_TRIPS_URL, trip => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);
      return trip;
    });
    console.log('Trips loaded:', trips.length);
  } catch (error) {
    console.error('Error loading trips CSV:', error);
    return;
  }

  // First render (no time filtering)
  updateScatterPlot(timeFilter);

  // Ensure labels match initial state
  updateTimeDisplay();

  // Keep markers aligned as the map moves/zooms
  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);
});

// Check that Mapbox GL JS is loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);
