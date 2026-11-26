import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Crosshair,
  Save,
  Trash2,
  Play,
  Pause,
  Clock,
  Users,
  Repeat,
  Wallet,
  TrendingUp,
  Eye,
  Plus,
  CheckCircle2,
  AlertCircle,
  Upload,
  Link2,
  Layers,
} from 'lucide-react';
import { apiFetch } from '../utils/api.js';
import {
  formatRupiah,
  formatCompactRupiah,
  formatNumber,
  formatPercent,
} from '../utils/format.js';

const DEFAULT_CENTER = [-6.9175, 107.6191]; // Bandung & KBB area
const DEFAULT_ZOOM = 11;

const OSM_TILE_URL = '/api/map-tiles/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';

/**
 * Parses Google Maps links or plain "lat, lng" text into { lat, lng }.
 */
function parseCoordinatesInput(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  // 1. Google Maps !3dLAT!4dLNG pattern
  const bangMatch = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bangMatch) {
    const lat = Number(bangMatch[1]);
    const lng = Number(bangMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 2. Google Maps @LAT,LNG or ?q=LAT,LNG or plain "LAT, LNG"
  const pairMatch = text.match(/(-?\d{1,2}\.\d{3,})\s*[,\s]\s*(-?\d{1,3}\.\d{3,})/);
  if (pairMatch) {
    const lat = Number(pairMatch[1]);
    const lng = Number(pairMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
}

function isValidLatLng(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export default function OutletMapView({
  allOutlets = [],
  onInspectOutlet,
  canEdit = true,
  onOpenCustomerHabits,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const draftMarkerRef = useRef(null);

  const [isLightTheme, setIsLightTheme] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('light') : false
  );

  // Saved locations from backend
  const [locations, setLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(true);

  // Map visualization controls
  const [mapMetric, setMapMetric] = useState('trx'); // 'trx' | 'omset' | 'komisi' | 'growth' | 'repeat'
  const [mapStyleMode, setMapStyleMode] = useState('cluster'); // 'cluster' | 'pill' | 'bubble' | 'heat'
  const [clusterFilter, setClusterFilter] = useState('official'); // 'official' | 'plc' | 'kbb' | 'all'
  const [hourFilter, setHourFilter] = useState('all'); // 'all' | 'shift_pagi' | 'shift_siang' | 'shift_sore' | 'shift_malam' | 0..23
  const [isPlayingHours, setIsPlayingHours] = useState(false);
  const [showPinLabels, setShowPinLabels] = useState(true);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);

  // Right panel mode: 'input' | 'habit' | 'bulk'
  const [panelTab, setPanelTab] = useState('input');
  const [selectedOutletName, setSelectedOutletName] = useState('');
  const [pickOnMapMode, setPickOnMapMode] = useState(true);
  const [quickLinkInput, setQuickLinkInput] = useState('');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null); // { type: 'success'|'error', text }

  // Bulk import text
  const [bulkText, setBulkText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Observe html.light / html.dark theme changes
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const observer = new MutationObserver(() => {
      setIsLightTheme(document.documentElement.classList.contains('light'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Fetch saved outlet locations
  const loadLocations = useCallback(async () => {
    setLoadingLocations(true);
    try {
      const res = await apiFetch('/api/outlet-locations');
      const data = await res.json();
      if (res.ok && Array.isArray(data.locations)) {
        setLocations(data.locations);
      }
    } catch {
      // Ignore fetch error; status shown if needed
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Filtered outlets based on clusterFilter
  const scopedOutlets = useMemo(() => {
    return allOutlets.filter((o) => {
      if (clusterFilter === 'official') return o.isOfficialOutlet;
      if (clusterFilter === 'plc') return o.groupId === 'out_plc';
      if (clusterFilter === 'kbb') return o.groupId === 'out_kbb';
      return true;
    });
  }, [allOutlets, clusterFilter]);

  // Default selected outlet to first official outlet if none chosen yet
  useEffect(() => {
    if (!selectedOutletName && scopedOutlets.length > 0) {
      setSelectedOutletName(scopedOutlets[0].outletName);
    }
  }, [scopedOutlets, selectedOutletName]);

  const locationByName = useMemo(() => {
    const map = new Map();
    for (const loc of locations) {
      map.set(String(loc.outletName || '').trim().toUpperCase(), loc);
    }
    return map;
  }, [locations]);

  const selectedOutletObj = useMemo(
    () =>
      allOutlets.find(
        (o) => String(o.outletName || '').trim().toUpperCase() === String(selectedOutletName || '').trim().toUpperCase()
      ) || null,
    [allOutlets, selectedOutletName]
  );

  // Sync form fields when selectedOutletName changes
  useEffect(() => {
    if (!selectedOutletName) return;
    const existing = locationByName.get(selectedOutletName.trim().toUpperCase());
    if (existing) {
      setFormLat(String(existing.lat));
      setFormLng(String(existing.lng));
      setFormAddress(existing.address || '');
      setFormCity(existing.city || '');
      setFormNotes(existing.notes || '');
    } else {
      setFormLat('');
      setFormLng('');
      setFormAddress('');
      setFormCity('');
      setFormNotes('');
    }
    setQuickLinkInput('');
  }, [selectedOutletName, locationByName]);

  // Hour playback animation
  useEffect(() => {
    if (!isPlayingHours) return undefined;
    const timer = setInterval(() => {
      setHourFilter((prev) => {
        if (typeof prev !== 'number') return 6;
        return prev >= 23 ? 0 : prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlayingHours]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return undefined;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    const tileLayer = L.tileLayer(OSM_TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    tileLayerRef.current = tileLayer;
    markersLayerRef.current = markersLayer;

    const handleZoom = () => setMapZoom(map.getZoom());
    map.on('zoomend', handleZoom);

    // Ensure proper sizing after mount
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.off('zoomend', handleZoom);
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      markersLayerRef.current = null;
      draftMarkerRef.current = null;
    };
  }, []);

  // Ensure map container resizes cleanly when theme changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.invalidateSize();
  }, [isLightTheme]);

  // Handle click-to-pick coordinates on map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return undefined;

    const handleMapClick = (e) => {
      if (!canEdit || !pickOnMapMode || panelTab !== 'input') return;
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));
      setFormLat(String(lat));
      setFormLng(String(lng));
      setStatusMsg({
        type: 'success',
        text: `Titik dipilih dari peta: ${lat}, ${lng}. Klik "Simpan Titik" untuk menyimpan.`,
      });
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [canEdit, pickOnMapMode, panelTab]);

  // Render draft preview marker when formLat/formLng are valid
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (draftMarkerRef.current) {
      draftMarkerRef.current.remove();
      draftMarkerRef.current = null;
    }

    const lat = Number(formLat);
    const lng = Number(formLng);
    const existing = selectedOutletName
      ? locationByName.get(selectedOutletName.trim().toUpperCase())
      : null;
    const isSameAsSaved =
      existing &&
      Math.abs(Number(existing.lat) - lat) < 1e-6 &&
      Math.abs(Number(existing.lng) - lng) < 1e-6;

    if (panelTab === 'input' && isValidLatLng(lat, lng) && !isSameAsSaved) {
      const marker = L.circleMarker([lat, lng], {
        radius: 10,
        color: '#f59e0b',
        weight: 3,
        dashArray: '4 4',
        fillColor: '#fbbf24',
        fillOpacity: 0.45,
      }).addTo(map);
      marker.bindTooltip(`Preview Titik: ${selectedOutletName || 'Cabang'}`, {
        direction: 'top',
      });
      draftMarkerRef.current = marker;
    }
  }, [formLat, formLng, panelTab, selectedOutletName, locationByName]);

  const SHIFT_RANGES = useMemo(
    () => ({
      shift_pagi: { label: 'Pagi (06–11)', from: 6, to: 11 },
      shift_siang: { label: 'Siang (12–16)', from: 12, to: 16 },
      shift_sore: { label: 'Sore (17–20)', from: 17, to: 20 },
      shift_malam: { label: 'Malam (21–23)', from: 21, to: 23 },
    }),
    []
  );

  // Sum trx & omset for the active hour / shift / full 24h
  const getScopedTrxAndOmset = useCallback(
    (outlet) => {
      if (hourFilter === 'all') {
        return { trx: outlet.trxD1 || 0, omset: outlet.omsetD1 || 0 };
      }
      if (typeof hourFilter === 'number') {
        const hObj = outlet.hourlyComparison?.[hourFilter];
        return { trx: hObj?.trxD1 || 0, omset: hObj?.omsetD1 || 0 };
      }
      const range = SHIFT_RANGES[hourFilter];
      if (!range) {
        return { trx: outlet.trxD1 || 0, omset: outlet.omsetD1 || 0 };
      }
      let trx = 0;
      let omset = 0;
      for (let hr = range.from; hr <= range.to; hr++) {
        const hObj = outlet.hourlyComparison?.[hr];
        if (hObj) {
          trx += hObj.trxD1 || 0;
          omset += hObj.omsetD1 || 0;
        }
      }
      return { trx, omset };
    },
    [hourFilter, SHIFT_RANGES]
  );

  // Compute metric value for an outlet (supports hourFilter & shifts!)
  const getMetricValue = useCallback(
    (outlet) => {
      if (hourFilter !== 'all') {
        const scoped = getScopedTrxAndOmset(outlet);
        return mapMetric === 'omset' ? scoped.omset : scoped.trx;
      }
      if (mapMetric === 'omset') return outlet.omsetD1 || 0;
      if (mapMetric === 'komisi') return outlet.komisiD1 || 0;
      if (mapMetric === 'growth') return outlet.selisihPct || 0;
      if (mapMetric === 'repeat') return outlet.customerHabit?.repeatRateD1 || 0;
      return outlet.trxD1 || 0;
    },
    [hourFilter, mapMetric, getScopedTrxAndOmset]
  );

  const formatPinBadgeLabel = useCallback(
    (val) => {
      if (hourFilter !== 'all') {
        if (mapMetric === 'omset') {
          if (val === 0) return '0';
          return val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}Jt` : `${Math.round(val / 1_000)}Rb`;
        }
        return formatNumber(val);
      }
      if (mapMetric === 'omset' || mapMetric === 'komisi') {
        if (val === 0) return '0';
        return val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}Jt` : `${Math.round(val / 1_000)}Rb`;
      }
      if (mapMetric === 'growth') {
        return `${val > 0 ? '+' : ''}${Math.round(val)}%`;
      }
      if (mapMetric === 'repeat') {
        return `${val}%`;
      }
      return formatNumber(val);
    },
    [hourFilter, mapMetric]
  );

  const activeTimeLabel = useMemo(() => {
    if (hourFilter === 'all') return '00:00 – 23:59';
    if (typeof hourFilter === 'number') return `Jam ${String(hourFilter).padStart(2, '0')}:00`;
    return SHIFT_RANGES[hourFilter]?.label || '00:00 – 23:59';
  }, [hourFilter, SHIFT_RANGES]);

  // Top 5 busiest branches in the selected time window
  const topActiveOutlets = useMemo(() => {
    return [...scopedOutlets]
      .map((o) => {
        const scoped = getScopedTrxAndOmset(o);
        return { outlet: o, scoped, val: getMetricValue(o) };
      })
      .filter((item) => item.scoped.trx > 0)
      .sort((a, b) => b.val - a.val || b.scoped.trx - a.scoped.trx)
      .slice(0, 5);
  }, [scopedOutlets, getScopedTrxAndOmset, getMetricValue]);

  // Render saved pins onto Leaflet markersLayer (supports Cluster, Pin Ringkas, Bubble, Heatmap)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const pinnedItems = scopedOutlets
      .map((outlet) => {
        const loc = locationByName.get(String(outlet.outletName || '').trim().toUpperCase());
        if (!loc || !isValidLatLng(loc.lat, loc.lng)) return null;
        return {
          outlet,
          loc,
          val: getMetricValue(outlet),
          scoped: getScopedTrxAndOmset(outlet),
        };
      })
      .filter(Boolean);

    const maxVal = Math.max(1, ...pinnedItems.map((i) => Math.abs(i.val)));

    const getPinColor = (outlet, val) => {
      if (mapMetric === 'growth') {
        return val > 0 ? '#10b981' : val < 0 ? '#f43f5e' : '#64748b';
      }
      if (hourFilter !== 'all' && val === 0) return '#64748b';
      if (outlet.groupId === 'out_kbb') return '#10b981';
      if (outlet.groupId === 'non_plc_kbb') return '#64748b';
      return '#6366f1';
    };

    const renderSinglePin = ({ outlet, latLng, val, scoped, compact = false }) => {
      const ratio = Math.min(1, Math.max(0.15, Math.abs(val) / maxVal));
      const color = getPinColor(outlet, val);
      const isSelected =
        String(outlet.outletName || '').trim().toUpperCase() ===
        String(selectedOutletName || '').trim().toUpperCase();

      // Adaptive radius for Bubble vs Compact dot
      const zoomScale = mapZoom <= 11 ? 0.65 : mapZoom <= 13 ? 0.85 : 1.05;
      const radius = compact
        ? 6
        : val === 0 && hourFilter !== 'all'
        ? 8
        : Math.round((7 + ratio * 15) * zoomScale);

      const circle = L.circleMarker(latLng, {
        radius,
        color: isSelected ? '#f59e0b' : '#ffffff',
        weight: isSelected ? 3 : 1.5,
        fillColor: color,
        fillOpacity: hourFilter !== 'all' && val === 0 ? 0.35 : compact ? 0.92 : 0.68,
      });

      const habit = outlet.customerHabit || {};
      const timeRowHtml =
        hourFilter !== 'all'
          ? `<div style="font-size:11px;color:#0ea5e9"><b>${activeTimeLabel}:</b> ${formatNumber(scoped.trx)} Trx (${formatCompactRupiah(scoped.omset)})</div>`
          : '';
      circle.bindTooltip(
        `<div style="min-width:180px;font-family:Inter,sans-serif">
          <div style="font-weight:800;font-size:12px;margin-bottom:2px">${outlet.outletName}</div>
          <div style="font-size:11px;opacity:0.85">${outlet.subCluster || outlet.groupName}</div>
          <hr style="margin:4px 0;opacity:0.2"/>
          ${timeRowHtml}
          <div style="font-size:11px">Total 24J: <b>${formatNumber(outlet.trxD1)} Trx</b> | <b>${formatCompactRupiah(outlet.omsetD1)}</b></div>
          <div style="font-size:11px">Repeat Pelanggan: <b>${habit.repeatRateD1 ?? 0}%</b> (${habit.uniqueCustomersD1 ?? 0} tujuan)</div>
          <div style="font-size:11px">Jam Puncak: <b>${outlet.peakHour || '-'}</b></div>
        </div>`,
        { direction: 'top', sticky: true }
      );

      circle.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedOutletName(outlet.outletName);
        setPanelTab('habit');
      });

      circle.addTo(layer);

      if (showPinLabels) {
        const badgeText = formatPinBadgeLabel(val);
        if (compact) {
          const shortCode =
            outlet.outletCode && outlet.outletCode !== '-' ? `${outlet.outletCode} • ` : '';
          const groupCls =
            val === 0
              ? 'map-pill-badge--zero'
              : outlet.groupId === 'out_kbb'
              ? 'map-pill-badge--kbb'
              : 'map-pill-badge--plc';
          L.marker(latLng, {
            interactive: false,
            icon: L.divIcon({
              className: 'map-pin-badge-wrap',
              iconSize: [0, 0],
              html: `<span class="map-pill-badge ${groupCls}">${shortCode}${badgeText}</span>`,
            }),
          }).addTo(layer);
        } else {
          L.marker(latLng, {
            interactive: false,
            icon: L.divIcon({
              className: 'map-pin-badge-wrap',
              iconSize: [0, 0],
              html: `<span class="map-pin-badge ${val === 0 ? 'map-pin-badge--zero' : ''}">${badgeText}</span>`,
            }),
          }).addTo(layer);
        }
      }
    };

    if (mapStyleMode === 'heat') {
      // Mode 4: Heatmap glow blobs + small clickable dots
      for (const item of pinnedItems) {
        const ratio = Math.min(1, Math.max(0.1, Math.abs(item.val) / maxVal));
        const size = Math.round(36 + ratio * 64);
        const heatColor =
          item.val === 0
            ? 'rgba(100, 116, 139, 0.22)'
            : ratio >= 0.7
            ? 'rgba(239, 68, 68, 0.78)'
            : ratio >= 0.35
            ? 'rgba(245, 158, 11, 0.72)'
            : 'rgba(56, 189, 248, 0.62)';

        L.marker([item.loc.lat, item.loc.lng], {
          interactive: false,
          icon: L.divIcon({
            className: 'map-pin-badge-wrap',
            iconSize: [0, 0],
            html: `<div class="map-heat-blob" style="width:${size}px;height:${size}px;background:radial-gradient(circle, ${heatColor} 0%, rgba(0,0,0,0) 72%);"></div>`,
          }),
        }).addTo(layer);

        renderSinglePin({
          ...item,
          latLng: [item.loc.lat, item.loc.lng],
          compact: true,
        });
      }
    } else if (mapStyleMode === 'cluster') {
      // Mode 1: Screen-space pixel clustering (merges nearby branches when zoomed out, spiderfies at zoom >= 16)
      const thresholdPx = 46;
      const points = pinnedItems.map((item) => ({
        item,
        pt: map.latLngToLayerPoint([item.loc.lat, item.loc.lng]),
      }));
      const visited = new Set();
      const clusters = [];

      for (let i = 0; i < points.length; i++) {
        if (visited.has(i)) continue;
        visited.add(i);
        const group = [points[i]];
        for (let j = i + 1; j < points.length; j++) {
          if (visited.has(j)) continue;
          const dx = points[i].pt.x - points[j].pt.x;
          const dy = points[i].pt.y - points[j].pt.y;
          if (Math.hypot(dx, dy) <= thresholdPx) {
            visited.add(j);
            group.push(points[j]);
          }
        }
        clusters.push(group);
      }

      for (const group of clusters) {
        if (group.length === 1) {
          const { item } = group[0];
          renderSinglePin({
            ...item,
            latLng: [item.loc.lat, item.loc.lng],
            compact: true,
          });
        } else if (mapZoom >= 16) {
          // Spiderfy overlapping pins in a small neat ring at deep zoom
          const avgLat = group.reduce((s, g) => s + g.item.loc.lat, 0) / group.length;
          const avgLng = group.reduce((s, g) => s + g.item.loc.lng, 0) / group.length;
          const centerPt = map.latLngToLayerPoint([avgLat, avgLng]);
          const ringRadiusPx = 28 + group.length * 4;

          group.forEach((g, idx) => {
            const angle = (2 * Math.PI * idx) / group.length;
            const offsetPt = L.point(
              centerPt.x + ringRadiusPx * Math.cos(angle),
              centerPt.y + ringRadiusPx * Math.sin(angle)
            );
            const spiderLatLng = map.layerPointToLatLng(offsetPt);
            L.polyline([[avgLat, avgLng], spiderLatLng], {
              color: '#94a3b8',
              weight: 1.5,
              dashArray: '3 3',
            }).addTo(layer);
            renderSinglePin({
              ...g.item,
              latLng: [spiderLatLng.lat, spiderLatLng.lng],
              compact: true,
            });
          });
        } else {
          // Render cluster badge
          const avgLat = group.reduce((s, g) => s + g.item.loc.lat, 0) / group.length;
          const avgLng = group.reduce((s, g) => s + g.item.loc.lng, 0) / group.length;
          const totalVal = group.reduce((s, g) => s + g.item.val, 0);
          const sumDisplay =
            mapMetric === 'growth' || mapMetric === 'repeat'
              ? `${(totalVal / group.length).toFixed(1)}%`
              : formatPinBadgeLabel(totalVal);

          const clusterMarker = L.marker([avgLat, avgLng], {
            icon: L.divIcon({
              className: 'map-cluster-wrap',
              iconSize: [52, 52],
              iconAnchor: [26, 26],
              html: `<div class="map-cluster-badge">
                <span class="map-cluster-count">${group.length} Cabang</span>
                <span class="map-cluster-val">${sumDisplay}</span>
              </div>`,
            }),
          });

          const listHtml = group
            .slice(0, 6)
            .map(
              (g) =>
                `<div style="font-size:11px">• ${g.item.outlet.outletName}: <b>${formatPinBadgeLabel(g.item.val)}</b></div>`
            )
            .join('');
          clusterMarker.bindTooltip(
            `<div style="min-width:170px;font-family:Inter,sans-serif">
              <div style="font-weight:800;font-size:12px;margin-bottom:3px">${group.length} Cabang Berdekatan</div>
              ${listHtml}
              ${group.length > 6 ? `<div style="font-size:10px;opacity:0.75">+${group.length - 6} cabang lainnya...</div>` : ''}
              <div style="font-size:10px;color:#0ea5e9;margin-top:4px">Klik untuk zoom & pecah titik</div>
            </div>`,
            { direction: 'top', sticky: true }
          );

          clusterMarker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            map.setView([avgLat, avgLng], Math.min(18, map.getZoom() + 2));
          });

          clusterMarker.addTo(layer);
        }
      }
    } else {
      // Mode 2 ('pill') or Mode 3 ('bubble')
      const compact = mapStyleMode === 'pill';
      for (const item of pinnedItems) {
        renderSinglePin({
          ...item,
          latLng: [item.loc.lat, item.loc.lng],
          compact,
        });
      }
    }
  }, [
    scopedOutlets,
    locationByName,
    getMetricValue,
    getScopedTrxAndOmset,
    formatPinBadgeLabel,
    activeTimeLabel,
    showPinLabels,
    mapMetric,
    mapStyleMode,
    mapZoom,
    hourFilter,
    selectedOutletName,
    panelTab,
  ]);

  const handleFitAllPins = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const pts = locations
      .filter((l) => isValidLatLng(l.lat, l.lng))
      .map((l) => [l.lat, l.lng]);
    if (pts.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    } else if (pts.length === 1) {
      map.setView(pts[0], 14);
    } else {
      map.fitBounds(pts, { padding: [40, 40] });
    }
  };

  const handleQuickLinkParse = (value) => {
    setQuickLinkInput(value);
    const parsed = parseCoordinatesInput(value);
    if (parsed) {
      setFormLat(String(Number(parsed.lat.toFixed(6))));
      setFormLng(String(Number(parsed.lng.toFixed(6))));
      setStatusMsg({
        type: 'success',
        text: `Koordinat berhasil dibaca: ${parsed.lat.toFixed(6)}, ${parsed.lng.toFixed(6)}`,
      });
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([parsed.lat, parsed.lng], 14);
      }
    }
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!selectedOutletName) {
      setStatusMsg({ type: 'error', text: 'Pilih cabang terlebih dahulu.' });
      return;
    }
    const lat = Number(formLat);
    const lng = Number(formLng);
    if (!isValidLatLng(lat, lng)) {
      setStatusMsg({
        type: 'error',
        text: 'Latitude / Longitude tidak valid. Klik peta atau paste link Google Maps.',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch('/api/outlet-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletName: selectedOutletName,
          outletCode: selectedOutletObj?.outletCode || '-',
          lat,
          lng,
          address: formAddress,
          city: formCity,
          notes: formNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'error', text: data.error || 'Gagal menyimpan koordinat.' });
        return;
      }
      if (Array.isArray(data.locations)) {
        setLocations(data.locations);
      }
      setStatusMsg({
        type: 'success',
        text: `Titik lokasi "${selectedOutletName}" berhasil disimpan!`,
      });
    } catch {
      setStatusMsg({ type: 'error', text: 'Gagal menghubungi server.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!selectedOutletName) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await apiFetch(`/api/outlet-locations/${encodeURIComponent(selectedOutletName)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'error', text: data.error || 'Gagal menghapus titik.' });
        return;
      }
      setLocations(data.locations || []);
      setFormLat('');
      setFormLng('');
      setFormAddress('');
      setFormCity('');
      setFormNotes('');
      setStatusMsg({ type: 'success', text: `Titik lokasi "${selectedOutletName}" dihapus.` });
    } catch {
      setStatusMsg({ type: 'error', text: 'Gagal menghubungi server.' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSave = async () => {
    setStatusMsg(null);
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const entries = [];
    for (const line of lines) {
      // Support: NamaCabang, -6.9175, 107.6191, Alamat opsional
      const parts = line.split(/[,\t;|]/).map((p) => p.trim());
      if (parts.length < 3) continue;
      const outletName = parts[0];
      const lat = Number(parts[1]);
      const lng = Number(parts[2]);
      const address = parts.slice(3).join(', ');
      if (outletName && isValidLatLng(lat, lng)) {
        const matched = allOutlets.find(
          (o) => o.outletName.trim().toUpperCase() === outletName.toUpperCase()
        );
        entries.push({
          outletName: matched ? matched.outletName : outletName,
          outletCode: matched?.outletCode || '-',
          lat,
          lng,
          address,
        });
      }
    }

    if (entries.length === 0) {
      setStatusMsg({
        type: 'error',
        text: 'Format tidak terbaca. Gunakan: NamaCabang, Latitude, Longitude, Alamat (1 baris per cabang).',
      });
      return;
    }

    setBulkSaving(true);
    try {
      const res = await apiFetch('/api/outlet-locations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'error', text: data.error || 'Gagal import koordinat.' });
        return;
      }
      setLocations(data.locations || []);
      setBulkText('');
      setStatusMsg({
        type: 'success',
        text: `Berhasil menyimpan ${data.savedCount} titik lokasi cabang!`,
      });
      setPanelTab('input');
    } catch {
      setStatusMsg({ type: 'error', text: 'Gagal menghubungi server.' });
    } finally {
      setBulkSaving(false);
    }
  };

  const pinnedCount = scopedOutlets.filter((o) =>
    locationByName.has(String(o.outletName || '').trim().toUpperCase())
  ).length;

  const selectedHasPin =
    selectedOutletName &&
    locationByName.has(String(selectedOutletName || '').trim().toUpperCase());

  const habit = selectedOutletObj?.customerHabit || {};

  return (
    <div className="space-y-4">
      {/* Top Map Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mr-1">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Visualisasi:</span>
          </div>
          {[
            { id: 'trx', label: 'Total Trx' },
            { id: 'omset', label: 'Omzet' },
            { id: 'komisi', label: 'Komisi' },
            { id: 'growth', label: 'Pertumbuhan DoD' },
            { id: 'repeat', label: 'Repeat Pelanggan' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMapMetric(m.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                mapMetric === m.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Map Style Mode Switcher */}
          <div className="inline-flex rounded-lg bg-slate-950/70 p-0.5 border border-slate-800">
            {[
              { id: 'cluster', label: 'Cluster' },
              { id: 'pill', label: 'Pin Ringkas' },
              { id: 'bubble', label: 'Bubble' },
              { id: 'heat', label: 'Heatmap' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setMapStyleMode(st.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                  mapStyleMode === st.id
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <select
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none"
          >
            <option value="official">Cabang Resmi (PLC & KBB)</option>
            <option value="plc">Cabang PLC Saja</option>
            <option value="kbb">Cabang KBB Saja</option>
            <option value="all">Semua Cabang & Agen</option>
          </select>

          <button
            type="button"
            onClick={() => setShowPinLabels((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
              showPinLabels
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Tampilkan angka nilai langsung di atas titik peta"
          >
            <span>Angka di Titik: {showPinLabels ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={handleFitAllPins}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            Fokus Semua Titik ({pinnedCount}/{scopedOutlets.length})
          </button>
        </div>
      </div>

      {/* Hour Slider & Shift Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 shrink-0 mr-1">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Pergerakan Jam & Shift:</span>
          </div>

          {[
            { id: 'all', label: 'Semua (24J)' },
            { id: 'shift_pagi', label: 'Pagi (06–11)' },
            { id: 'shift_siang', label: 'Siang (12–16)' },
            { id: 'shift_sore', label: 'Sore (17–20)' },
            { id: 'shift_malam', label: 'Malam (21–23)' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setIsPlayingHours(false);
                setHourFilter(p.id);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                hourFilter === p.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setIsPlayingHours((p) => !p)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            title="Putar animasi transaksi per jam"
          >
            {isPlayingHours ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlayingHours ? 'Pause' : 'Play Jam'}</span>
          </button>

          <input
            type="range"
            min="0"
            max="23"
            value={typeof hourFilter === 'number' ? hourFilter : 12}
            onChange={(e) => {
              setIsPlayingHours(false);
              setHourFilter(Number(e.target.value));
            }}
            className="flex-1 min-w-[140px] accent-indigo-500 cursor-pointer"
          />

          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-indigo-300">
            {activeTimeLabel}
          </span>
        </div>

        {/* Top 5 Active Branches in Selected Hour / Shift */}
        {topActiveOutlets.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80 text-[11px]">
            <span className="font-bold text-slate-400 mr-1">
              Top Cabang ({activeTimeLabel}):
            </span>
            {topActiveOutlets.map(({ outlet, scoped }, idx) => (
              <button
                key={outlet.outletName}
                type="button"
                onClick={() => {
                  setSelectedOutletName(outlet.outletName);
                  setPanelTab('habit');
                  const loc = locationByName.get(outlet.outletName.trim().toUpperCase());
                  if (loc && mapInstanceRef.current) {
                    mapInstanceRef.current.setView([loc.lat, loc.lng], 14);
                  }
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
              >
                <span className="text-amber-400 font-bold">#{idx + 1}</span>
                <span className="font-semibold">{outlet.outletName}</span>
                <span className="text-indigo-300 font-mono font-bold">
                  ({formatNumber(scoped.trx)} Trx)
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Split: Left Map + Right Coordinate & Habit Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Map Canvas */}
        <div className="xl:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                PLC
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                KBB
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                Preview Input Titik
              </span>
            </div>
            {panelTab === 'input' && canEdit && pickOnMapMode && (
              <span className="text-[11px] font-bold text-amber-300 animate-pulse">
                Mode Pilih Titik Aktif — Klik lokasi cabang langsung di peta
              </span>
            )}
          </div>

          <div
            ref={mapContainerRef}
            className="w-full h-[460px] sm:h-[520px] z-0"
            style={{ cursor: panelTab === 'input' && pickOnMapMode && canEdit ? 'crosshair' : 'grab' }}
          />
        </div>

        {/* Right Side Panel */}
        <div className="xl:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          {/* Panel Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setPanelTab('input')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                panelTab === 'input'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Input Titik
            </button>
            <button
              type="button"
              onClick={() => setPanelTab('habit')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                panelTab === 'habit'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Habit Cabang
            </button>
            <button
              type="button"
              onClick={() => setPanelTab('bulk')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                panelTab === 'bulk'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Import Massal
            </button>
          </div>

          {statusMsg && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* TAB 1: INPUT KOORDINAT + TITIK */}
          {panelTab === 'input' && (
            <form onSubmit={handleSaveLocation} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Pilih Cabang ({pinnedCount}/{scopedOutlets.length} sudah punya titik)
                </label>
                <select
                  value={selectedOutletName}
                  onChange={(e) => setSelectedOutletName(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-none"
                >
                  {scopedOutlets.map((o) => {
                    const hasPin = locationByName.has(
                      String(o.outletName || '').trim().toUpperCase()
                    );
                    return (
                      <option key={o.outletName} value={o.outletName}>
                        {hasPin ? '📍 ' : '○ '}
                        {o.outletName} ({o.outletCode !== '-' ? o.outletCode : o.subCluster})
                      </option>
                    );
                  })}
                </select>
              </div>

              {canEdit ? (
                <>
                  {/* Mode Pilih di Peta */}
                  <button
                    type="button"
                    onClick={() => setPickOnMapMode((v) => !v)}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      pickOnMapMode
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>
                      {pickOnMapMode
                        ? 'Klik Peta untuk Ambil Titik: AKTIF'
                        : 'Aktifkan Mode Klik Peta'}
                    </span>
                  </button>

                  {/* Quick Paste Google Maps Link */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Paste Link Google Maps / Koordinat Cepat
                    </label>
                    <div className="relative">
                      <Link2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={quickLinkInput}
                        onChange={(e) => handleQuickLinkParse(e.target.value)}
                        placeholder="Contoh: -6.9175, 107.6191 atau link Google Maps"
                        className="w-full bg-slate-950/70 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Lat / Lng */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Latitude
                      </label>
                      <input
                        type="text"
                        value={formLat}
                        onChange={(e) => setFormLat(e.target.value)}
                        placeholder="-6.917500"
                        className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Longitude
                      </label>
                      <input
                        type="text"
                        value={formLng}
                        onChange={(e) => setFormLng(e.target.value)}
                        placeholder="107.619100"
                        className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Kecamatan / Kota
                      </label>
                      <input
                        type="text"
                        value={formCity}
                        onChange={(e) => setFormCity(e.target.value)}
                        placeholder="Contoh: Padalarang"
                        className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Catatan Area
                      </label>
                      <input
                        type="text"
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        placeholder="Dekat pasar / ruko"
                        className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Alamat Lengkap (Opsional)
                    </label>
                    <input
                      type="text"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder="Jl. Raya ..."
                      className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-bold transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Menyimpan...' : selectedHasPin ? 'Update Titik' : 'Simpan Titik'}</span>
                    </button>

                    {selectedHasPin && (
                      <button
                        type="button"
                        onClick={handleDeleteLocation}
                        disabled={saving}
                        className="px-3 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition-colors"
                        title="Hapus titik lokasi cabang ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-xs text-slate-300">
                  Akun Anda memiliki akses <b>Viewer</b>. Hubungi <b>Admin / Analyst</b> untuk menambah atau mengubah titik koordinat cabang.
                </div>
              )}
            </form>
          )}

          {/* TAB 2: HABIT PELANGGAN CABANG TERPILIH */}
          {panelTab === 'habit' && (
            <div className="space-y-3">
              {selectedOutletObj ? (
                <>
                  <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-white">
                          {selectedOutletObj.outletName}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {selectedOutletObj.subCluster || selectedOutletObj.groupName}
                          {locationByName.get(selectedOutletObj.outletName.toUpperCase())?.city
                            ? ` • ${locationByName.get(selectedOutletObj.outletName.toUpperCase()).city}`
                            : ''}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {selectedOutletObj.outletCode}
                      </span>
                    </div>
                  </div>

                  {/* Performance Summary */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Trx & Omzet (D1)</div>
                      <div className="text-sm font-extrabold text-white mt-0.5 tabular-nums">
                        {formatNumber(selectedOutletObj.trxD1)} Trx
                      </div>
                      <div className="text-[11px] text-indigo-300 font-semibold tabular-nums">
                        {formatCompactRupiah(selectedOutletObj.omsetD1)}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Komisi & Pertumbuhan</div>
                      <div className="text-sm font-extrabold text-emerald-400 mt-0.5 tabular-nums">
                        {formatRupiah(selectedOutletObj.komisiD1)}
                      </div>
                      <div
                        className={`text-[11px] font-bold tabular-nums ${
                          selectedOutletObj.selisihPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatPercent(selectedOutletObj.selisihPct)} DoD
                      </div>
                    </div>
                  </div>

                  {/* Customer Habit Breakdown */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                    <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Habit Pelanggan di Lokasi Ini</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Users className="w-3 h-3 text-indigo-400" /> Pelanggan Unik
                        </div>
                        <div className="font-extrabold text-white mt-0.5 tabular-nums">
                          {formatNumber(habit.uniqueCustomersD1 || 0)} nomor
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Repeat className="w-3 h-3 text-emerald-400" /> Repeat Order
                        </div>
                        <div className="font-extrabold text-emerald-400 mt-0.5 tabular-nums">
                          {habit.repeatRateD1 || 0}% ({formatNumber(habit.repeatCustomersD1 || 0)})
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Wallet className="w-3 h-3 text-amber-400" /> Rata-rata / Trx
                        </div>
                        <div className="font-extrabold text-white mt-0.5 tabular-nums">
                          {formatRupiah(habit.avgTicketSizeD1 || 0)}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-cyan-400" /> Waktu Dominan
                        </div>
                        <div className="font-bold text-cyan-300 mt-0.5 text-[11px]">
                          {habit.dominantTimeSlotD1 || '-'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Kategori Favorit:</span>
                      <span className="font-bold text-indigo-300">{habit.topCategoryD1 || '-'}</span>
                    </div>

                    {(habit.topCustomersD1 || []).length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Top Nomor Sering Transaksi (D1)
                        </div>
                        <div className="space-y-1">
                          {(habit.topCustomersD1 || []).slice(0, 5).map((c) => (
                            <div
                              key={c.tujuan}
                              className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-800 tabular-nums"
                            >
                              <div className="min-w-0 truncate">
                                <span className="font-mono font-bold text-white">{c.tujuan}</span>
                                <span className="text-slate-400 ml-1.5">({c.topProduct})</span>
                              </div>
                              <div className="shrink-0 ml-2 font-bold text-indigo-300">
                                {c.trx}x • {c.peakHour}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectOutlet?.(selectedOutletObj)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail 360°</span>
                    </button>
                    {onOpenCustomerHabits && (
                      <button
                        type="button"
                        onClick={() => onOpenCustomerHabits(selectedOutletObj.outletName)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Habit Pelanggan</span>
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setPanelTab('input')}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Edit Titik</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  Klik salah satu titik cabang di peta untuk melihat analisa habit pelanggan.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BULK IMPORT KOORDINAT */}
          {panelTab === 'bulk' && (
            <div className="space-y-3">
              {canEdit ? (
                <>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Tempel banyak koordinat sekaligus (1 baris per cabang) dengan format:
                    <br />
                    <code className="text-indigo-300">NamaCabang, Latitude, Longitude, Alamat</code>
                  </p>
                  <textarea
                    rows={8}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`PLC DM, -6.917464, 107.619123, Jl. Dewi Sartika Bandung\nKBB PADALARANG, -6.842100, 107.475800, Padalarang KBB`}
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-xl p-3 font-mono text-[11px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBulkSave}
                    disabled={bulkSaving}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{bulkSaving ? 'Mengimpor...' : 'Simpan Semua Titik'}</span>
                  </button>
                </>
              ) : (
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-xs text-slate-300">
                  Fitur import massal hanya tersedia untuk role <b>Admin / Analyst</b>.
                </div>
              )}
            </div>
          )}

          {/* Quick Status Footer */}
          <div className="mt-auto pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {loadingLocations
                ? 'Memuat titik lokasi...'
                : `${pinnedCount} cabang terpasang di peta`}
            </span>
            {canEdit && panelTab !== 'input' && (
              <button
                type="button"
                onClick={() => setPanelTab('input')}
                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold"
              >
                <Plus className="w-3 h-3" /> Input Titik
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
