const fs = require('fs');
const path = require('path');

const protobuf = require('protobufjs');
const brotli = require('brotli');
const fetch = require('node-fetch');

const { getHashPrefix } = require('./hash_prefix')

function relPath(p) {
  return path.resolve(__dirname, p);
}

function getURL(env, publisherID) {
  let prefix = getHashPrefix(publisherID, 2);
  switch (env) {
    case 'staging': return `https://pcdn.bravesoftware.com/publishers/prefixes/${prefix}`
    case 'prod': return `https://pcdn.brave.com/publishers/prefixes/${prefix}`
  }
  throw new Error(`Invalid environment string: ${env}`);
}

function unpad(buffer) {
  let length = buffer.readUInt32BE(0);
  return buffer.slice(4, length + 4);
}

function decompress(buffer) {
  return brotli.decompress(buffer);
}

let whenProtoLoaded = null;
function loadProtobuf() {
  if (!whenProtoLoaded) {
    whenProtoLoaded = new Promise((resolve, reject) => {
      protobuf.load(relPath('channel_response.proto'), (err, root) => {
        if (err) reject(err);
        else resolve(root);
      });
    });
  }
  return whenProtoLoaded;
}

async function fetchChannel(publisherID, env = 'prod') {
  let url = getURL(env, publisherID);
  let content = await fetch(url).then(response => response.buffer());
  let data = await readChannelList(content);

  return {
    url() { return url; },
    messageObject() { return data.messageObject(); },
    channelInfo() { return data ? data.find(publisherID) : null; },
  };
}

async function readChannelFile(filePath) {
  let content = await new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  return readChannelList(content);
}

async function readChannelList(content) {
  let root = await loadProtobuf();
  let ChannelResponseList = root.lookup('ChannelResponseList');

  try {
    content = decompress(unpad(content));
  } catch {
    throw new Error('Error decompressing channel response data');
  }

  let message = ChannelResponseList.decode(content);
  let object = ChannelResponseList.toObject(message, {
    enums: String,
    longs: String,
    defaults: true,
    arrays: true,
    objects: true,
    oneofs: true
  });

  return {
    messageObject() { return object; },
    find(publisherID) {
      for (let response of object.channelResponses) {
        if (response.channelIdentifier === publisherID) {
          return response;
        }
      }
      return null;
    }
  }
}

module.exports = { fetchChannel, readChannelFile, readChannelList };
