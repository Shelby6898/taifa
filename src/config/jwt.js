const JWT_SECRET = process.env.JWT_SECRET;

if (
  typeof JWT_SECRET !== "string" ||
  JWT_SECRET.trim().length === 0 ||
  JWT_SECRET === "secret_key" ||
  JWT_SECRET === "CHANGE_THIS_TO_A_STRONG_SECRET" ||
  JWT_SECRET === "your_jwt_secret_key"
) {
  throw new Error(
    "JWT_SECRET must be configured with a strong secret before the application starts."
  );
}

module.exports = { JWT_SECRET };
