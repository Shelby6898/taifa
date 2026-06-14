import { useState, useEffect } from "react";
import { api } from "../api";

let orgCache = null;

export default function useOrg() {
  const [org, setOrg] = useState(orgCache);
  const [loading, setLoading] = useState(!orgCache);

  useEffect(() => {
    if (orgCache) { setOrg(orgCache); setLoading(false); return; }
    api.get("/organizations/mine")
      .then(res => {
        orgCache = res.data.data;
        setOrg(orgCache);
      })
      .catch(() => {
        // fallback defaults if org fetch fails
        orgCache = {
          locationLabel: "Location",
          locationLabelPlural: "Locations",
          unitLabel: "Department",
          unitLabelPlural: "Departments",
          locations: [],
          units: []
        };
        setOrg(orgCache);
      })
      .finally(() => setLoading(false));
  }, []);

  return { org, loading };
}
