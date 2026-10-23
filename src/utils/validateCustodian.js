/**
 * Validates a proposed custodian against the asset's tenant.
 * A missing userStatus is treated as active for legacy compatibility.
 */
async function validateCustodian(db, asset, custodianId, custodianName) {
  const invalid = {
    ok: false,
    message:
      "Custodian must be an active user in this asset's organization, and the name must match the user's profile."
  };

  if (
    !asset ||
    !asset.orgId ||
    !custodianId ||
    typeof custodianName !== "string" ||
    !custodianName.trim()
  ) {
    return invalid;
  }

  const userDoc = await db.collection("users").doc(custodianId).get();

  if (!userDoc.exists) {
    return invalid;
  }

  const user = userDoc.data() || {};
  const userStatus = user.userStatus || "active";

  if (
    !user.orgId ||
    user.orgId !== asset.orgId ||
    userStatus !== "active" ||
    typeof user.name !== "string" ||
    user.name.trim() !== custodianName.trim()
  ) {
    return invalid;
  }

  return { ok: true };
}

module.exports = validateCustodian;
