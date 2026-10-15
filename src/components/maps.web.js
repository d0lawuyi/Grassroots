/*
 * Website version of the map, built on Leaflet (a free web map library) with
 * OpenStreetMap streets and Esri satellite photos. It copies only the parts of
 * react-native-maps that Grassroots uses, so the screens don't change:
 *
 *   <MapView style initialRegion mapType scrollEnabled zoomEnabled onLongPress ref>
 *     ref.animateToRegion(region, ms)
 *   <Marker coordinate title description pinColor onPress onCalloutPress draggable onDragEnd>
 *
 * Long-press on a phone browser, or right-click with a mouse, places a pin (onLongPress).
 * Leaflet loads from a CDN the first time a map appears, so it adds nothing to the app download.
 * Custom marker contents (a View inside <Marker>) are drawn as a plain dot on the web.
 */
import React, { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { COLORS } from '../theme/colors';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet';

const TILES = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri',
  },
  labels: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  },
};

export const PROVIDER_GOOGLE = 'google';

/* Loads Leaflet's script and stylesheet once, however many maps are on the page. */
let leafletPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = `${LEAFLET}.css`;
      document.head.appendChild(css);

      const script = document.createElement('script');
      script.src = `${LEAFLET}.js`;
      script.onload = () => resolve(window.L);
      script.onerror = () => {
        leafletPromise = null; // let the next map try again
        reject(new Error('Could not load the map'));
      };
      document.head.appendChild(script);
    });
  }
  return leafletPromise;
}

/*
 * react-native-maps describes the view by how many degrees it spans; Leaflet uses a zoom level.
 * At zoom z a 256-pixel tile covers 360 / 2^z degrees, so a map about 350 pixels wide spans
 * 360 * 350 / (256 * 2^z) degrees. Solving for z: log2(492 / delta).
 */
export function zoomForDelta(latitudeDelta) {
  const delta = Number(latitudeDelta) > 0 ? Number(latitudeDelta) : 0.05;
  return Math.max(2, Math.min(19, Math.round(Math.log2(492 / delta))));
}

const toLatLng = (c) => [Number(c.latitude), Number(c.longitude)];
const event = (latlng) => ({ nativeEvent: { coordinate: { latitude: latlng.lat, longitude: latlng.lng } } });

const MapContext = createContext(null);

const MapView = forwardRef(function MapView(props, ref) {
  const { style, initialRegion, mapType = 'standard', scrollEnabled = true, zoomEnabled = true, children } = props;
  const box = useRef(null);
  const [map, setMap] = useState(null);
  const [failed, setFailed] = useState(false);
  const latest = useRef(props);
  latest.current = props;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let created = null;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !box.current) return;
        const region = initialRegion || { latitude: 39.7684, longitude: -86.1581, latitudeDelta: 0.12 };
        created = L.map(box.current, {
          center: toLatLng(region),
          zoom: zoomForDelta(region.latitudeDelta),
          dragging: scrollEnabled,
          scrollWheelZoom: zoomEnabled,
          doubleClickZoom: zoomEnabled,
          touchZoom: zoomEnabled,
          boxZoom: zoomEnabled,
          keyboard: scrollEnabled,
          zoomControl: zoomEnabled,
        });
        created.attributionControl.setPrefix(false);
        // Leaflet's "contextmenu" is a long-press on touch screens and a right-click with a mouse.
        created.on('contextmenu', (e) => latest.current.onLongPress?.(event(e.latlng)));
        created.on('click', (e) => latest.current.onPress?.(event(e.latlng)));
        setMap(created);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      created?.remove();
    };
  }, []);

  // Street map, satellite, or satellite with place names ("hybrid").
  useEffect(() => {
    if (!map) return undefined;
    const L = window.L;
    const layers =
      mapType === 'standard'
        ? [L.tileLayer(TILES.standard.url, { maxZoom: 19, attribution: TILES.standard.attribution })]
        : [L.tileLayer(TILES.satellite.url, { maxZoom: 19, attribution: TILES.satellite.attribution })];
    if (mapType === 'hybrid') layers.push(L.tileLayer(TILES.labels.url, { maxZoom: 19 }));
    layers.forEach((layer) => layer.addTo(map));
    return () => layers.forEach((layer) => layer.remove());
  }, [map, mapType]);

  useImperativeHandle(ref, () => ({
    animateToRegion(region, ms = 400) {
      map?.flyTo(toLatLng(region), zoomForDelta(region.latitudeDelta), { duration: ms / 1000 });
    },
  }), [map]);

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: COLORS.sage }, style]}>
      <div ref={box} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 0 }} />
      {failed ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.mute, fontSize: 13 }}>
          Map unavailable right now
        </div>
      ) : null}
      <MapContext.Provider value={map}>{children}</MapContext.Provider>
    </View>
  );
});

/* A round pin in the marker's colour (the phone app's pinColor). */
function pinIcon(L, color) {
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
    html: `<div style="width:18px;height:18px;border-radius:9px;background:${color};border:2px solid #FFFDF8;box-shadow:0 1px 4px rgba(23,32,25,0.35)"></div>`,
  });
}

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function Marker(props) {
  const { coordinate, title, description, pinColor, draggable = false, children } = props;
  const map = useContext(MapContext);
  const marker = useRef(null);
  const latest = useRef(props);
  latest.current = props;
  const color = pinColor || (children ? COLORS.forest : COLORS.clay);

  useEffect(() => {
    if (!map) return undefined;
    const L = window.L;
    const m = L.marker(toLatLng(coordinate), { icon: pinIcon(L, color), draggable, title: title || '' });
    m.on('click', () => latest.current.onPress?.());
    m.on('dragend', () => latest.current.onDragEnd?.(event(m.getLatLng())));
    if (title || description) {
      const popup = document.createElement('div');
      popup.style.cursor = latest.current.onCalloutPress ? 'pointer' : 'default';
      popup.innerHTML =
        `<strong>${escapeHtml(title || '')}</strong>` +
        (description ? `<div style="color:${COLORS.mute};margin-top:2px">${escapeHtml(description)}</div>` : '');
      popup.addEventListener('click', () => latest.current.onCalloutPress?.());
      m.bindPopup(popup);
    }
    m.addTo(map);
    marker.current = m;
    return () => {
      m.remove();
      marker.current = null;
    };
  }, [map, title, description, color, draggable]);

  // Move the pin without rebuilding it.
  useEffect(() => {
    marker.current?.setLatLng(toLatLng(coordinate));
  }, [coordinate?.latitude, coordinate?.longitude]);

  return null;
}

export default MapView;
