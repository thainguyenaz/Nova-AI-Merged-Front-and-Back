const memory = require('./memoryAdapter');

const driver = (process.env.DB_DRIVER || 'memory').toLowerCase();

let repo = memory;
if (driver === 'postgres') {
  // Lazy require so local smoke can run without postgres
  // eslint-disable-next-line global-require
  repo = require('./postgresAdapter');
}

module.exports = { repo, driver };
