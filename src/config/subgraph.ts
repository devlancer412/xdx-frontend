import {
  // ARBITRUM,
  AVALANCHE,
  AVALANCHE_TESTNET,
} from "./chains";

export const SUBGRAPH_URLS = {
  // [ARBITRUM]: {
  //   stats: "https://api.thegraph.com/subgraphs/name/gmx-io/gmx-stats",
  //   referrals: "https://api.thegraph.com/subgraphs/name/gmx-io/gmx-arbitrum-referrals",
  //   nissohVault: "https://api.thegraph.com/subgraphs/name/nissoh/gmx-vault",
  // },

  [AVALANCHE]: {
    stats: "https://api.thegraph.com/subgraphs/name/gmx-io/gmx-avalanche-stats",
    referrals: "https://api.thegraph.com/subgraphs/name/gmx-io/gmx-avalanche-referrals",
  },

  [AVALANCHE_TESTNET]: {
    stats: "https://api.thegraph.com/subgraphs/name/devlancer412/xdx-avax-test-stats",
    referrals: "https://api.thegraph.com/subgraphs/name/devlancer412/xdx-avax-test-referrals",
  },

  common: {
    chainLink: "https://api.thegraph.com/subgraphs/name/deividask/chainlink",
  },
};
