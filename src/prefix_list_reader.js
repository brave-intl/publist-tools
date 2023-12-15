import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import protobuf from 'protobufjs';
import brotli from 'brotli';
import fetch from 'node-fetch';

import { getHashPrefix } from './hash_prefix.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getURL(env) {
  switch (env) {
    case 'staging': return 'https://rewards-stg.bravesoftware.com/publishers/prefix-list';
    case 'prod': return 'https://rewards.brave.com/publishers/prefix-list'
  }
  throw new Error(`Invalid environment string: ${env}`);
}

function relPath(p) {
  return path.resolve(__dirname, p);
}

let whenProtoLoaded = null;
function loadProtobuf() {
  if (!whenProtoLoaded) {
    whenProtoLoaded = new Promise((resolve, reject) => {
      protobuf.load(relPath('publisher_list.proto'), (err, root) => {
        if (err) reject(err);
        else resolve(root);
      });
    });
  }
  return whenProtoLoaded;
}

async function fetchPrefixList(env = 'prod') {
  let url = getURL(env);
  let content = await fetch(getURL(env)).then(response => response.buffer());
  return readPrefixList(content, url);
}

async function readPrefixFile(filePath) {
  let content = await new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  return readPrefixList(content);
}

async function readPrefixList(content, url = '') {
  let root = await loadProtobuf();
  let PublisherList = root.lookup('PublisherList');
  let message = PublisherList.decode(content);
  let object = PublisherList.toObject(message, {
    enums: String,
    longs: String,
    defaults: true,
    arrays: true,
    objects: true,
    oneofs: true
  });

  let prefixes = object.prefixes;
  if (object.compressionType = 'BROTLI_COMPRESSION') {
    prefixes = Buffer.from(brotli.decompress(prefixes));
  }

  return {
    url() { return url; },
    prefixes() { return prefixes },
    messageObject() { return object; },
    search(publisherID) {
      let searchPrefix = getHashPrefix(publisherID, object.prefixSize);
      for (let offset = 0; offset < prefixes.byteLength; offset += object.prefixSize) {
        let prefix = prefixes.slice(offset, offset + object.prefixSize).toString('hex');
        if (prefix === searchPrefix) {
          return true;
        }
      }
      return false;
    }
  };
}

export { fetchPrefixList, readPrefixFile, readPrefixList };
