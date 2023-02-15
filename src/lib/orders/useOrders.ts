import { gql } from "@apollo/client";
import { useWeb3React } from "@web3-react/core";
import { getUsd, InfoTokens } from "domain/tokens";
import { BigNumber } from "ethers";
import { getXdxGraphClient } from "lib/subgraph";
import { useState, useCallback } from "react";
import useInterval from "../useInterval";

export type Order = {
  isSale: boolean;
  size: number;
  price: number;
  time?: string;
};

type state = {
  buyOrders: Order[];
  sellOrders: Order[];
};
export const useOrders = (token: string, infoTokens: InfoTokens, size: number = 10) => {
  const [orders, setOrders] = useState<state>({
    buyOrders: [],
    sellOrders: [],
  });
  const { chainId } = useWeb3React();

  const updateOrders = useCallback(async () => {
    if (!chainId || !token || !infoTokens) {
      return;
    }
    const graphClient = getXdxGraphClient(chainId);
    const query = gql(`{
      buyOrders: orders(
        first: ${size},
        orderBy: triggerPrice,
        orderDirection: desc,
        where: {
          status: open,
          indexToken: "${token.toLowerCase()}"
        }
      ) {
        collateral
        collateralToken
        triggerPrice
      }
      sellOrders: orders(
        first: ${size},
        orderBy: triggerPrice,
        orderDirection: asc,
        where: {
          status: open,
          collateralToken: "${token.toLowerCase()}"
        }
      ) {
        collateral
        collateralToken
        triggerPrice
      }
    }`);

    const response = await graphClient.query({ query });

    const buyOrders = response.data.buyOrders.map((data: any) => {
      const usdValue = getUsd(BigNumber.from(data?.collateral), data?.collateralToken, false, infoTokens);

      return {
        isSale: false,
        size:
          BigNumber.from(usdValue ?? "0")
            .mul(1000)
            .div(data?.triggerPrice ?? "1")
            .toNumber() / 1000,
        price:
          BigNumber.from(data?.triggerPrice ?? "0")
            .div("1000000000000000000000000000")
            .toNumber() / 1000,
      };
    });
    const sellOrders = response.data.sellOrders.map((data: any) => {
      const usdValue = getUsd(BigNumber.from(data?.collateral), data?.collateralToken, false, infoTokens);

      return {
        isSale: false,
        size:
          BigNumber.from(usdValue ?? "0")
            .mul(1000)
            .div(data?.triggerPrice ?? "1")
            .toNumber() / 1000,
        price:
          BigNumber.from(data?.triggerPrice ?? "0")
            .div("1000000000000000000000000000")
            .toNumber() / 1000,
      };
    });

    setOrders({ buyOrders, sellOrders });
  }, [token, chainId, size, infoTokens]);

  useInterval(updateOrders, 5000);

  return orders;
};
