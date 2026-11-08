const { db, admin } = require("../config/firebase");

const MIN_GAP_MS = 10 * 1000;          // ignore pings closer together than this
const HISTORY_GAP_MS = 5 * 60 * 1000;  // save a history point at least this often
const HISTORY_MIN_METRES = 50;         // or when the asset has moved this far

function metres(a, b) {
  const R = 6371000;
  const rad = x => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Custodian (or admin) reports where the asset is now
exports.reportLocation = async (req, res) => {
  try {
    const { lat, lng, accuracy } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number" ||
        !Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: "Valid lat and lng numbers are required" });
    }
    if (accuracy !== undefined && accuracy !== null &&
        (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0)) {
      return res.status(400).json({ success: false, message: "accuracy must be a positive number" });
    }

    const ref = db.collection("assets").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = doc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }
    if (asset.status === "DISPOSED") {
      return res.status(400).json({ success: false, message: "Cannot track a disposed asset" });
    }

    const isAdmin = ["admin", "super-admin"].includes(req.user.role);
    const isCustodian = asset.custodianId
      ? asset.custodianId === req.user.userId
      : !!asset.custodian && asset.custodian === req.user.name;
    if (!isAdmin && !isCustodian) {
      return res.status(403).json({ success: false, message: "Only the custodian or an admin can report this asset's location" });
    }

    const now = admin.firestore.Timestamp.now();
    const prev = asset.geo || null;
    if (prev && prev.updatedAt && now.toMillis() - prev.updatedAt.toMillis() < MIN_GAP_MS) {
      return res.status(200).json({ success: true, skipped: true });
    }

    const point = {
      lat, lng,
      accuracy: accuracy === undefined ? null : accuracy,
      updatedAt: now,
      reportedBy: req.user.userId,
      reportedByName: req.user.name,
      savedAt: prev ? prev.savedAt || null : null,
      savedLat: prev ? prev.savedLat ?? null : null,
      savedLng: prev ? prev.savedLng ?? null : null
    };

    const save = !prev || !prev.savedAt ||
      now.toMillis() - prev.savedAt.toMillis() >= HISTORY_GAP_MS ||
      prev.savedLat == null || prev.savedLng == null ||
      metres({ lat: prev.savedLat, lng: prev.savedLng }, { lat, lng }) >= HISTORY_MIN_METRES;

    const batch = db.batch();
    if (save) {
      point.savedAt = now;
      point.savedLat = lat;
      point.savedLng = lng;
      batch.set(db.collection("asset_locations").doc(), {
        assetId: req.params.id,
        orgId: asset.orgId,
        lat, lng,
        accuracy: point.accuracy,
        reportedBy: req.user.userId,
        reportedByName: req.user.name,
        timestamp: now
      });
    }
    batch.update(ref, { geo: point });
    await batch.commit();

    res.status(200).json({ success: true, saved: save });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Latest known position of every asset the user is allowed to see
exports.getLocations = async (req, res) => {
  try {
    let query = db.collection("assets");
    if (req.user.role === "manager" && req.user.department) {
      query = query.where("department", "==", req.user.department);
    } else if (req.user.role === "viewer") {
      query = query.where("custodian", "==", req.user.name);
    }

    const snapshot = await query.get();
    const data = snapshot.docs
      .map(d => ({ assetId: d.id, ...d.data() }))
      .filter(a => (req.user.role === "super-admin" || a.orgId === req.user.orgId))
      .filter(a => a.status !== "DISPOSED" && a.geo)
      .filter(a => req.user.role !== "viewer" || !a.custodianId || a.custodianId === req.user.userId)
      .map(a => ({
        assetId: a.assetId,
        name: a.name,
        assetCode: a.assetCode,
        type: a.type,
        department: a.department,
        status: a.status,
        custodian: a.custodian || null,
        geo: {
          lat: a.geo.lat,
          lng: a.geo.lng,
          accuracy: a.geo.accuracy === undefined ? null : a.geo.accuracy,
          updatedAt: a.geo.updatedAt ? a.geo.updatedAt.toMillis() : null
        }
      }));

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
