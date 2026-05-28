function generateAssetCode(ward) {
  const prefix = "TFA";

  const wardCode = ward
    .replace(/\s+/g, "")
    .substring(0, 3)
    .toUpperCase();

  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

  return `${prefix}-${wardCode}-${random}`;
}

module.exports = generateAssetCode;
