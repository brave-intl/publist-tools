const crypto = require('crypto');

function getHashPrefix(publisherID, size = 4) {
  let hash = crypto.createHash('sha256');
  hash.update(publisherID);
  return hash.digest().slice(0, size).toString('hex');
}

module.exports = { getHashPrefix };
