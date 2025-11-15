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

mapboxgl.accessToken =
  'pk.eyJ1IjoidmFuZXNzYWxmZW5nIiwiYSI6ImNtaHpwNDBlcjBjb2cyam9najdmMHdieTMifQ.cGOsnvL8OINWs416eljWLA';


let stations = [];
let trips = [];

let timeFilter = -1;
let radiusScale;
let circles;

const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

const svg = d3.select('#map').select('svg');


function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

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

function updatePositions() {
  svg
    .selectAll('circle')
    .attr('cx', d => getCoords(d).cx)
    .attr('cy', d => getCoords(d).cy);
}


const timeSlider = document.getElementById('time-slider');
const selectedTimeEl = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

function formatTime(minutes) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setMinutes(minutes);
  return date.toLocaleTimeString('en-US', { timeStyle: 'short' });
}

function updateTimeDisplay() {
  if (!timeSlider) return;

  timeFilter = Number(timeSlider.value);

  if (timeFilter === -1) {
    selectedTimeEl.textContent = '';
    anyTimeLabel.style.display = 'inline';
  } else {
    selectedTimeEl.textContent = formatTime(timeFilter);
    anyTimeLabel.style.display = 'none';
  }

  if (!stations.length || !trips.length) return;

  updateScatterPlot(timeFilter);
}

if (timeSlider) {
  timeSlider.addEventListener('input', updateTimeDisplay);
}


function updateScatterPlot(timeFilterValue) {
  const filteredTrips = filterTripsByTime(trips, timeFilterValue);

  const stationsWithTraffic = computeStationTraffic(stations, filteredTrips);

  const maxTraffic = d3.max(stationsWithTraffic, d => d.totalTraffic) || 1;

  if (!radiusScale) {
    radiusScale = d3
      .scaleSqrt()
      .domain([0, maxTraffic])
      .range([0, 25]);
  } else {
    radiusScale.domain([0, maxTraffic]);
  }

  radiusScale.range(
    timeFilterValue === -1
      ? [0, 25]
      : [3, 50]
  );

  circles = svg
    .selectAll('circle')
    .data(stationsWithTraffic, d => d.short_name);

  const circlesEnter = circles
    .enter()
    .append('circle')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('fill-opacity', 0.6);

  const circlesMerged = circlesEnter.merge(circles);

  circlesMerged
    .attr('r', d => radiusScale(d.totalTraffic))
    .style('--departure-ratio', d => {
      if (!d.totalTraffic) return stationFlow(0.5);
      const ratio = d.departures / d.totalTraffic;
      return stationFlow(ratio);
    });

  circlesMerged.select('title').remove();
  circlesMerged.each(function (d) {
    d3.select(this)
      .append('title')
      .text(
        `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
      );
  });

  circles.exit().remove();

  updatePositions();
}


map.on('load', async () => {
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

  let jsonData;
  try {
    jsonData = await d3.json(INPUT_BLUEBIKES_STATIONS_URL);
    stations = jsonData.data.stations;
    console.log('Stations loaded:', stations.length);
  } catch (error) {
    console.error('Error loading station JSON:', error);
    return;
  }

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

  updateScatterPlot(timeFilter);

  updateTimeDisplay();

  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);
});

console.log('Mapbox GL JS Loaded:', mapboxgl);
