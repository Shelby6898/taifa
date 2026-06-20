import { useState, useEffect, useCallback } from "react";
import { api } from "../api";

let orgCache = null;

async function fetchOrg() {
  try {
    const res = await api.get("/organizations/mine");
    orgCache = res.data.data;
  } catch {
    orgCache = orgCache || {
      locationLabel: "Location",
      locationLabelPlural: "Locations",
      unitLabel: "Department",
      unitLabelPlural: "Departments",
      locations: [],
      units: []
    };
  }
  return orgCache;
}

export default function useOrg() {
  const [org, setOrg] = useState(orgCache);
  const [loading, setLoading] = useState(!orgCache);

  const reload = useCallback(() => {
    setLoading(true);
    fetchOrg().then(data => {
      setOrg(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!orgCache) {
      reload();
    }
    window.addEventListener("org-updated", reload);
    return () => window.removeEventListener("org-updated", reload);
  }, [reload]);

  return { org, loading };
}
