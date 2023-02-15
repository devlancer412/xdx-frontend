import * as React from "react";
import {
  ChartingLibraryWidgetOptions,
  IChartingLibraryWidget,
  ResolutionString,
  IOrderLineAdapter,
  IPositionLineAdapter,
} from "../../../charting_library/charting_library";
import datafeed from "./mock/pricefeed";
import { getLiquidationPrice, INCREASE } from "lib/legacy";
import { bigNumberify } from "lib/numbers";
import { formatAmount } from "lib/numbers";
import { USD_DECIMALS } from "lib/legacy";
import { getToken } from "config/tokens";
import { DEFAULT_CHAIN_ID } from "config/chains";

export interface ChartContainerProps {
  symbol: ChartingLibraryWidgetOptions["symbol"];
  locale: ChartingLibraryWidgetOptions["locale"];
  interval: ChartingLibraryWidgetOptions["interval"];
  currentOrders: any[];
  positions: any[];
  chainId: number;
}

const PRICE_LINE_TEXT_WIDTH = 15;

export class TVProChartContainer extends React.PureComponent<Partial<ChartContainerProps>> {
  public static defaultProps: Omit<ChartContainerProps, "container"> = {
    symbol: "AAPL",
    locale: "en",
    interval: "1D" as ResolutionString,
    currentOrders: [],
    positions: [],
    chainId: DEFAULT_CHAIN_ID,
  };

  private tvWidget: IChartingLibraryWidget | null = null;
  private ref: React.RefObject<HTMLDivElement> = React.createRef();
  private isRunning: boolean = false;
  private lines: (IPositionLineAdapter | IOrderLineAdapter)[] = [];

  public override componentDidMount(): void {
    if (!this.ref.current) {
      return;
    }

    const widgetOptions: ChartingLibraryWidgetOptions = {
      symbol: this.props.symbol as string,
      locale: "en",
      // @ts-ignore
      datafeed: datafeed,
      interval: this.props.interval as ChartingLibraryWidgetOptions["interval"],
      container: this.ref.current,
      library_path: "/charting_library/",

      disabled_features: [
        "use_localstorage_for_settings",
        "show_spread_operators",
        "snapshot_trading_drawings",
        "trading_floating_toolbar",
        "adaptive_logo",
        "widget_logo",
        "header_symbol_search",
        "symbol_info",
        "property_pages",
        "create_volume_indicator_by_default",
      ],
      enabled_features: ["study_templates", "logo_without_link"],
      charts_storage_url: "https://saveload.tradingview.com",
      charts_storage_api_version: "1.1",
      client_id: "tradingview.com",
      user_id: "public_user_id",
      fullscreen: false,
      autosize: true,
      studies_overrides: {},
      theme: "Dark",
      overrides: {
        "paneProperties.backgroundType": "Solid",
        "paneProperties.background": "#181e2b",
        "paneProperties.vertGridProperties.color": "#1e293b",
        "paneProperties.horzGridProperties.color": "#1e293b",
        // "symbolWatermarkProperties.transparency": 90,
        // "scalesProperties.textColor": "#AAA",
        // "toolsPanProperties.textColor": "#ffffff",
        // "drawingToolsProperties.textColor": "#ffffff",
      },
      custom_css_url: "../themed.css",
      loading_screen: {
        foregroundColor: "#4f46e5",
        backgroundColor: "#181e2b",
      },
      drawings_access: { type: "black", tools: [{ name: "Font Icons", grayed: false }] },
    };

    const tvWidget = new (window as any).TradingView.widget(widgetOptions);
    this.tvWidget = tvWidget;

    tvWidget.onChartReady(() => {
      tvWidget.headerReady().then(() => {
        // const button = tvWidget.createButton();
        // button.setAttribute("title", "Click to show a notification popup");
        // button.classList.add("apply-common-tooltip");
        // button.addEventListener("click", () =>
        //   tvWidget.showNoticeDialog({
        //     title: "Notification",
        //     body: "TradingView Charting Library API works correctly",
        //     callback: () => {
        //       console.log("Noticed!");
        //     },
        //   })
        // );
        // button.innerHTML = "Check API";
        this.isRunning = true;
      });

      setTimeout(
        () =>
          this.updateLines(
            this.props.chainId ?? DEFAULT_CHAIN_ID,
            this.props.symbol as string,
            this.props.currentOrders ?? [],
            this.props.positions ?? []
          ),
        2000
      );
    });
  }

  public override componentWillUnmount(): void {
    if (this.tvWidget !== null) {
      this.tvWidget.remove();
      this.tvWidget = null;
    }
  }

  private updateLines = (chainId: number, symbol: string, orders: any[], positions: any[]) => {
    while (this.lines.length) {
      this.lines.pop()?.remove();
    }

    const chart = this.tvWidget?.chart();

    if (!chart) {
      return;
    }

    const color = "#3a3e5e";
    const mainSymbol = symbol.split(":")[1].split("/")[0];

    for (const order of orders) {
      try {
        const purchaseToken = getToken(chainId, order.purchaseToken);
        const indexToken = getToken(chainId, order.indexToken);
        let purchaseSymbol;
        let indexSymbol;
        if (purchaseToken && purchaseToken.symbol) {
          purchaseSymbol = purchaseToken.isWrapped ? purchaseToken.baseSymbol : purchaseToken.symbol;
          indexSymbol = indexToken.isWrapped ? indexToken.baseSymbol : indexToken.symbol;
        }
        if (mainSymbol === purchaseSymbol) {
          let line = chart
            .createOrderLine()
            .setText(`${order.type === INCREASE ? "Inc." : "Dec."} ${indexSymbol} ${order.isLong ? "Long" : "Short"}`)
            .setPrice(parseFloat(formatAmount(order.triggerPrice, USD_DECIMALS, 2)))
            .setQuantity(`$${formatAmount(order.sizeDelta, USD_DECIMALS, 2, true)}`)
            .setLineColor(color)
            .setExtendLeft(true)
            .setLineStyle(0);

          this.lines.push(line);
        }
      } catch (err) {
        console.error(err);
      }
    }

    for (const position of positions) {
      if (position?.indexToken?.symbol === mainSymbol) {
        try {
          const liquidationPrice = getLiquidationPrice(position) || bigNumberify(0);
          let line = chart
            .createPositionLine()
            .setText(
              `Liq. ${position.indexToken.symbol} ${position.isLong ? "Long" : "Short"}`.padEnd(
                PRICE_LINE_TEXT_WIDTH,
                " "
              )
            )
            .setPrice(parseFloat(formatAmount(liquidationPrice, USD_DECIMALS, 2)))
            .setQuantity(`$${formatAmount(position.size, USD_DECIMALS, 2, true)}`)
            .setLineColor(color)
            .setExtendLeft(true)
            .setLineStyle(0);

          this.lines.push(line);

          line = chart
            .createPositionLine()
            .setText(
              `Open ${position.indexToken.symbol} ${position.isLong ? "Long" : "Short"}`.padEnd(
                PRICE_LINE_TEXT_WIDTH,
                " "
              )
            )
            .setPrice(parseFloat(formatAmount(position.averagePrice, USD_DECIMALS, 2)))
            .setQuantity(`$${formatAmount(position.size, USD_DECIMALS, 2, true)}`)
            .setLineColor(color)
            .setExtendLeft(true)
            .setLineStyle(0);

          this.lines.push(line);
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  public override componentWillReceiveProps(props: ChartContainerProps) {
    const { symbol, interval, currentOrders, positions, chainId } = props;

    if (!this.isRunning || !this.tvWidget || !symbol) {
      return;
    }

    this.tvWidget.setSymbol(symbol, interval, () => {});

    this.updateLines(chainId, symbol, currentOrders, positions);
  }

  public override render(): JSX.Element {
    return <div ref={this.ref} className={"TVChartContainer h-full"} />;
  }
}
