import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api";

const STALE_MS = 24 * 60 * 60 * 1000;

function ago(ms) {
  if (!ms) return "unknown";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return m + " min ago";
  const h = Math.round(m / 60);
  if (h < 48) return h + " h ago";
  return Math.round(h / 24) + " days ago";
}

function esc(t) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(t == null ? "" : t).replace(/[&<>"']/g, c => map[c]);
}

export default function MapPage() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/assets/locations");
      setItems(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current).setView([0.5, 34.6], 9);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const pts = [];
    items.forEach(a => {
      const stale = !a.geo.updatedAt || Date.now() - a.geo.updatedAt > STALE_MS;
      const marker = L.circleMarker([a.geo.lat, a.geo.lng], {
        radius: 9, color: "#111827", weight: 1,
        fillColor: stale ? "#9ca3af" : "#16a34a", fillOpacity: 0.9
      });
      const acc = a.geo.accuracy != null ? "<br/>Accuracy: about " + Math.round(a.geo.accuracy) + " m" : "";
      marker.bindPopup(
        "<strong>" + esc(a.name) + "</strong><br/>" + esc(a.assetCode) +
        "<br/>Custodian: " + esc(a.custodian || "None") +
        "<br/>Department: " + esc(a.department || "") +
        "<br/>Updated: " + ago(a.geo.updatedAt) + acc
      );
      marker.addTo(layer);
      pts.push([a.geo.lat, a.geo.lng]);
    });
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
  }, [items]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>🗺️ Asset Map</h2>
        <button style={styles.btn} onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
      </div>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 10px" }}>
        Shows the last location shared for each asset. Grey pins were last updated more than 24 hours ago.
      </p>
      {error && <p style={{ color: "#dc2626" }}>❌ {error}</p>}
      {!loading && !error && items.length === 0 && (
        <p style={{ color: "#6b7280" }}>No locations shared yet. A custodian taps "Share location" on an asset to place it on the map.</p>
      )}
      <div ref={mapEl} style={{ position: "relative", zIndex: 0, height: "65vh", minHeight: 320, width: "100%", borderRadius: 8, border: "1px solid #e5e7eb" }} />
    </div>
  );
}

const styles = {
  btn: { background: "#0f172a", color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 }
};
