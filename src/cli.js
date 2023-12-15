#!/usr/bin/env node

import util from 'util';

import { fetchChannel } from './channel_reader.js';
import { fetchPrefixList } from './prefix_list_reader.js';
import { getHashPrefix } from './hash_prefix.js';

const help = `
publist-tools

  Some useful scripts for querying Brave Rewards publisher data.

Commands:

  [search] Searches the publisher prefix list

    publist-tools search --id "brave.com"
    publist-tools search --id "wikipedia.org" --env staging

  [fetch] Fetches publisher info

    publist-tools fetch --id "brave.com"
    publist-tools fetch --id "wikipedia.org" --env staging

`;

function getArgv() {
  return process.argv.slice(2);
}

const positionals = [
  'command'
];

function printObject(obj) {
  console.log(util.inspect(obj, {
    depth: 100,
    colors: true
  }));
}

function parseCommand(argv = getArgv()) {
  let args = new Map();
  let pos = 0;
  let key = null;
  for (let arg of argv) {
    if (arg.startsWith('-')) {
      if (key) {
        args.set(key, true);
      }
      key = arg;
    } else if (key) {
      args.set(key, arg);
      key = null;
    } else {
      if (pos < positionals.length) {
        args.set(positionals[pos++], arg);
      }
    }
  }

  if (key) {
    args.set(key, true);
  }

  return args;
}

function cliError(msg) {
  console.error(msg);
  process.exitCode = 1;
}

const commands = {
  async fetchPublisher(args) {
    let env = args.get('--env');
    let publisherID = args.get('--id');
    if (!publisherID) {
      cliError('Mising publisher ID');
      return;
    }
    let result = await fetchChannel(publisherID, env);
    printObject({
      url: result.url(),
      channelInfo: result.channelInfo(),
    });
  },

  async searchPrefixList(args) {
    let env = args.get('--env');
    let publisherID = args.get('--id');
    if (!publisherID) {
      cliError('Mising publisher ID');
      return;
    }
    let result = await fetchPrefixList(env);
    result.search(publisherID)
    printObject({
      url: result.url(),
      hashPrefix: getHashPrefix(publisherID),
      publisherFound: result.search(publisherID),
    });
  },
}

async function main() {
  let args = parseCommand();
  let command = args.get('command');
  if (!command) {
    console.log(help);
    return;
  }
  switch (command) {
    case 'fetch':
      return commands.fetchPublisher(args);
    case 'search':
      return commands.searchPrefixList(args);
    default:
      return cliError(`Unrecognized command "${command}"`);
  }
}

main().catch(err => { setTimeout(() => { throw err; }, 0); });
