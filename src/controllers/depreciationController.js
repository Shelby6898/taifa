const { db } = require("../config/firebase");


function calcDepreciation(asset) {
  const rate = asset.appreciationRate || asset.categoryRate || 20;
  const appreciationType = asset.appreciationType || "DEPRECIATION";
  const originalValue = asset.value || 0;

  // Get acquisition date
  let acquisitionDate;
  if (asset.acquisitionDate?._seconds) {
    acquisitionDate = new Date(asset.acquisitionDate._seconds * 1000);
  } else if (asset.acquisitionDate) {
    acquisitionDate = new Date(asset.acquisitionDate);
  } else {
    acquisitionDate = new Date(asset.createdAt?._seconds * 1000 || Date.now());
  }

  const now = new Date();
  const ageYears = Math.max(0, (now - acquisitionDate) / (1000 * 60 * 60 * 24 * 365.25));
  const ageMonths = Math.floor(ageYears * 12);

  // Straight-line depreciation or appreciation
  const annualChange = (originalValue * rate) / 100;
  const annualDepreciation = annualChange;
  const totalDepreciated = appreciationType === "APPRECIATION"
    ? 0
    : Math.min(originalValue, annualChange * ageYears);
  const currentValue = appreciationType === "APPRECIATION"
    ? Math.round(originalValue + annualChange * ageYears)
    : Math.max(0, originalValue - totalDepreciated);
  const depreciationPercent = originalValue > 0 ? (totalDepreciated / originalValue) * 100 : 0;

  // Useful life remaining
  const usefulLifeYears = rate > 0 ? 100 / rate : 999;
  const remainingLifeYears = Math.max(0, usefulLifeYears - ageYears);
  const remainingLifeMonths = Math.floor(remainingLifeYears * 12);

  // Status
  let condition = "Good";
  if (depreciationPercent >= 100) condition = "Fully Depreciated";
  else if (depreciationPercent >= 75) condition = "Poor";
  else if (depreciationPercent >= 50) condition = "Fair";
  else if (depreciationPercent >= 25) condition = "Good";
  else condition = "Excellent";

  return {
    assetId: asset.assetId,
    assetCode: asset.assetCode,
    name: asset.name,
    type: asset.type,
    department: asset.department,
    ward: asset.ward,
    originalValue,
    currentValue: Math.round(currentValue),
    totalDepreciated: Math.round(totalDepreciated),
    depreciationPercent: Math.round(depreciationPercent * 10) / 10,
    annualDepreciation: Math.round(annualDepreciation),
    monthlyDepreciation: Math.round(annualDepreciation / 12),
    depreciationRate: rate,
    ageYears: Math.round(ageYears * 10) / 10,
    ageMonths,
    remainingLifeYears: Math.round(remainingLifeYears * 10) / 10,
    remainingLifeMonths,
    acquisitionDate: acquisitionDate.toISOString(),
    condition,
    status: asset.status
  };
}

exports.getDepreciationReport = async (req, res) => {
  try {
    const snapshot = await db.collection("assets").get();
    let assets = snapshot.docs.map(doc => ({ assetId: doc.id, ...doc.data() }));

    // Organization isolation
    if (req.user.role !== "super-admin") {
      assets = assets.filter(a => a.orgId === req.user.orgId);
    }

    // Filter by department for non-admins
    if (req.user.role !== "admin" && req.user.department) {
      assets = assets.filter(a => a.department === req.user.department);
    }

    // Only active assets
    assets = assets.filter(a => a.status !== "DISPOSED");

    // Enrich with category rates
    const catCache = {};
    const enriched = await Promise.all(assets.map(async a => {
      if (a.categoryId) {
        if (!catCache[a.categoryId]) {
          const catDoc = await db.collection("asset_categories").doc(a.categoryId).get();
          if (catDoc.exists) catCache[a.categoryId] = catDoc.data();
        }
        const cat = catCache[a.categoryId];
        if (cat) {
          a.appreciationRate = cat.appreciationRate;
          a.appreciationType = cat.appreciationType;
        }
      }
      return a;
    }));
    const report = enriched.map(calcDepreciation);

    // Summary
    const summary = {
      totalAssets: report.length,
      totalOriginalValue: report.reduce((s, r) => s + r.originalValue, 0),
      totalCurrentValue: report.reduce((s, r) => s + r.currentValue, 0),
      totalDepreciated: report.reduce((s, r) => s + r.totalDepreciated, 0),
      annualDepreciationCost: report.reduce((s, r) => s + r.annualDepreciation, 0),
      fullyDepreciated: report.filter(r => r.condition === "Fully Depreciated").length,
      poor: report.filter(r => r.condition === "Poor").length,
      fair: report.filter(r => r.condition === "Fair").length,
      good: report.filter(r => r.condition === "Good").length,
      excellent: report.filter(r => r.condition === "Excellent").length
    };

    res.json({ success: true, summary, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAssetDepreciation = async (req, res) => {
  try {
    const doc = await db.collection("assets").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = { assetId: doc.id, ...doc.data() };

    if (req.user.role !== "super-admin" && asset.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const result = calcDepreciation(asset);

    // Year by year breakdown
    const acquisitionDate = new Date(result.acquisitionDate);
    const yearlyBreakdown = [];
    const usefulLife = Math.ceil(100 / (result.depreciationRate || 20));

    for (let year = 1; year <= Math.min(usefulLife, 20); year++) {
      const annual = result.annualDepreciation;
      const openingValue = Math.max(0, result.originalValue - annual * (year - 1));
      const closingValue = Math.max(0, openingValue - annual);
      yearlyBreakdown.push({
        year,
        calendarYear: acquisitionDate.getFullYear() + year,
        openingValue: Math.round(openingValue),
        depreciation: Math.round(Math.min(annual, openingValue)),
        closingValue: Math.round(closingValue),
        accumulated: Math.round(Math.min(result.originalValue, annual * year))
      });
      if (closingValue === 0) break;
    }

    res.json({ success: true, data: { ...result, yearlyBreakdown } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
