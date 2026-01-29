// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { stdin as input, stdout as output } from 'node:process';
import { createInterface, type Interface } from 'node:readline/promises';
import { type Logger } from 'pino';
import { type StartedDockerComposeEnvironment, type DockerComposeEnvironment } from 'testcontainers';
import { type CounterProviders, type DeployedCounterContract } from './common-types';
import { type Config, StandaloneConfig } from './config';
import * as api from './api';
import type { WalletContext } from './api';
import 'dotenv/config';

let logger: Logger;

/**
 * This seed gives access to tokens minted in the genesis block of a local development node - only
 * used in standalone networks to build a wallet with initial funds.
 */
const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const DEPLOY_OR_JOIN_QUESTION = `
You can do one of the following:
  1. Deploy a new counter contract
  2. Join an existing counter contract
  3. Exit
Which would you like to do? `;

const MAIN_LOOP_QUESTION = `
You can do one of the following:
  1. Increment
  2. Display current counter value
  3. Exit
Which would you like to do? `;

const join = async (providers: CounterProviders, rli: Interface): Promise<DeployedCounterContract> => {
  const contractAddress = await rli.question('What is the contract address (in hex)? ');
  return await api.joinContract(providers, contractAddress);
};

const deployOrJoin = async (providers: CounterProviders, rli: Interface): Promise<DeployedCounterContract | null> => {
  while (true) {
    const choice = await rli.question(DEPLOY_OR_JOIN_QUESTION);
    switch (choice) {
      case '1':
        return await api.deploy(providers, { privateCounter: 0 });
      case '2':
        return await join(providers, rli);
      case '3':
        logger.info('Exiting...');
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const mainLoop = async (providers: CounterProviders, rli: Interface, config: Config): Promise<void> => {
  const counterContract = await deployOrJoin(providers, rli);
  if (counterContract === null) {
    return;
  }
  while (true) {
    const choice = await rli.question(MAIN_LOOP_QUESTION);
    switch (choice) {
      case '1':
        await api.increment(counterContract);
        break;
      case '2':
        await api.displayCounterValue(providers, counterContract);
        break;
      case '3':
        logger.info('Exiting...');
        return;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const buildWalletFromMnemonic = async (config: Config, rli: Interface): Promise<WalletContext> => {
  const mnemonic = await rli.question('Enter your wallet mnemonic (24 words): ');
  return await api.buildWalletAndWaitForFunds(config, mnemonic);
};

const WALLET_LOOP_QUESTION = `
You can do one of the following:
  1. Build a fresh wallet
  2. Build wallet from a mnemonic
  3. Use mnemonic from .env file
  4. Exit
Which would you like to do? `;

const buildWallet = async (config: Config, rli: Interface): Promise<WalletContext | null> => {
  if (config instanceof StandaloneConfig) {
    // For standalone, use genesis wallet with hex seed
    return await api.buildWalletFromHexSeed(config, GENESIS_MINT_WALLET_SEED);
  }

  // Check if mnemonic is available in environment
  const envMnemonic = process.env.WALLET_MNEMONIC;

  while (true) {
    const choice = await rli.question(WALLET_LOOP_QUESTION);
    switch (choice) {
      case '1':
        return await api.buildFreshWallet(config);
      case '2':
        return await buildWalletFromMnemonic(config, rli);
      case '3':
        if (envMnemonic) {
          logger.info('Using mnemonic from .env file...');
          return await api.buildWalletAndWaitForFunds(config, envMnemonic);
        } else {
          logger.error('No WALLET_MNEMONIC found in .env file');
        }
        break;
      case '4':
        logger.info('Exiting...');
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const mapContainerPort = (env: StartedDockerComposeEnvironment, url: string, containerName: string) => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);

  mappedUrl.port = String(container.getFirstMappedPort());

  return mappedUrl.toString().replace(/\/+$/, '');
};

export const runDirectly = async (config: Config, _logger: Logger): Promise<void> => {
  logger = _logger;
  api.setLogger(_logger);
  const rli = createInterface({ input, output, terminal: true });
  let env;
  let sponsorWalletContext: WalletContext | null = null;

  // Sponsor wallet - has funds and dust to pay for transactions
  const mnemonic_funded = 'sell spell coral harsh actor faculty hawk spatial nest client story skin rally town rapid solid ginger olympic regret twist swallow cloud abuse shadow';
  sponsorWalletContext = await api.buildWalletAndWaitForFunds(config, mnemonic_funded);

  // This wallet will modify the contract state but doesn't need funds
  const mnemonic_empty = 'response jazz gate space chaos adjust life embark major kick iron taxi note cost visit slim glimpse settle motion response cream ivory sudden term';
  const proverKeys = await api.deriveKeysFromMnemonic(mnemonic_empty, config);
  logger.info(`Prover wallet address (will own contract state): ${proverKeys.unshieldedKeystore.getBech32Address().asString()}`);

  if (sponsorWalletContext !== null) {
    // Configure providers with sponsor (pays fees) and prover keys (owns state)
    const providers = await api.configureProviders(sponsorWalletContext, config, proverKeys);
    const contractAddress = '7d03ae7388bec1bf57814f672424e4162dab94111d37367782f61d46c2ba757d';
    const counterContract = await api.joinContract(providers, contractAddress);
    await api.increment(counterContract);
    
    // Cleanup - only sponsor wallet needs to be closed
    await api.closeWallet(sponsorWalletContext);
    process.exit(0);
  }
}

export const run = async (config: Config, _logger: Logger, dockerEnv?: DockerComposeEnvironment, doRunDirectly = false): Promise<void> => {
  if (doRunDirectly) {
    return runDirectly(config, _logger);
  }
  logger = _logger;
  api.setLogger(_logger);
  const rli = createInterface({ input, output, terminal: true });
  let env;
  let walletContext: WalletContext | null = null;

  if (dockerEnv !== undefined) {
    env = await dockerEnv.up();

    if (config instanceof StandaloneConfig) {
      config.indexer = mapContainerPort(env, config.indexer, 'counter-indexer');
      config.indexerWS = mapContainerPort(env, config.indexerWS, 'counter-indexer');
      config.node = mapContainerPort(env, config.node, 'counter-node');
      config.proofServer = mapContainerPort(env, config.proofServer, 'counter-proof-server');
    }
  }

  try {
    walletContext = await buildWallet(config, rli);
    if (walletContext !== null) {
      const providers = await api.configureProviders(walletContext, config);
      await mainLoop(providers, rli, config);
    }
  } catch (e) {
    if (e instanceof Error) {
      logger.error(`Found error '${e.message}'`);
      logger.info('Exiting...');
      logger.debug(`${e.stack}`);
    } else {
      throw e;
    }
  } finally {
    try {
      rli.close();
      rli.removeAllListeners();
    } catch (e) {
      logger.error(`Error closing readline interface: ${e}`);
    } finally {
      try {
        if (walletContext !== null) {
          await api.closeWallet(walletContext);
        }
      } catch (e) {
        logger.error(`Error closing wallet: ${e}`);
      } finally {
        try {
          if (env !== undefined) {
            await env.down();
            logger.info('Goodbye');
          }
        } catch (e) {
          logger.error(`Error shutting down docker environment: ${e}`);
        }
      }
    }
  }
};
