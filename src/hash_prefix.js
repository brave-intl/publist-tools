import crypto from 'crypto';

function getHashPrefix(publisherID, size = 4) {
  let hash = crypto.createHash('sha256');
  hash.update(publisherID);
  return hash.digest().slice(0, size).toString('hex');
}

export { getHashPrefix };
