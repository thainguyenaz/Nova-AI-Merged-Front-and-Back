const PHI_KEYS = [
  'firstName','lastName','fullName','name','dob','dateOfBirth','ssn','email','phone','address','notes','medicalHistory','diagnosis','allergies'
];

function redactValue(value) {
  if (value == null) return value;
  if (typeof value === 'string') return '[REDACTED]';
  if (typeof value === 'number') return 0;
  return '[REDACTED]';
}

function redactObject(input) {
  if (Array.isArray(input)) return input.map(redactObject);
  if (!input || typeof input !== 'object') return input;

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (PHI_KEYS.includes(key)) out[key] = redactValue(value);
    else if (value && typeof value === 'object') out[key] = redactObject(value);
    else out[key] = value;
  }
  return out;
}

module.exports = { redactObject, PHI_KEYS };
