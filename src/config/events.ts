// date format: d MMM yyyy, H:mm, time should be specifed based on UTC time

export type EventData = {
  id: string;
  title: string;
  isActive?: boolean;
  validTill: string;
  bodyText: string;
  buttons: {
    text: string;
    link: string;
    newTab: boolean;
  }[];
};

export const homeEventsData: EventData[] = [
  {
    id: "app-gmx-io-launch",
    title: "Frontend Updates",
    isActive: true,
    validTill: "10 Jul 2022, 12:00",
    bodyText:
      "Updates have been applied to the XDX frontend to inform users of the separation between gmx.io and app.gmx.io",
    buttons: [
      {
        text: "Read More",
        link: "https://medium.com/@gmx.io/gmx-frontend-updates-8d13f2346e1e",
        newTab: true,
      },
    ],
  },
  {
    id: "arbitrum-nitro-upgrade",
    title: "Arbitrum Nitro Upgrade",
    isActive: true,
    validTill: "31 Aug 2022, 20:00",
    bodyText: "The Arbitrum Nitro upgrade has been completed.",
    buttons: [
      {
        text: "Read More",
        link: "https://medium.com/@gmx.io/arbitrum-nitro-5f88c03a46fe",
        newTab: true,
      },
    ],
  },
];

export const appEventsData: EventData[] = [
  {
    id: "app-gmx-io-settings",
    title: "Frontend Updates",
    isActive: true,
    validTill: "10 Jul 2022, 12:00",
    bodyText:
      "You are currently using app.xdx.io. Customized settings have been reset, you may need to adjust your settings by clicking on the menu in the top right after connecting your wallet.",
    buttons: [
      {
        text: "Read More",
        link: "https://xdx.exchange/docs",
        newTab: true,
      },
    ],
  },
  {
    id: "use-alchemy-rpc-url",
    title: "Use Alchemy RPC URL",
    isActive: true,
    validTill: "10 Jul 2022, 12:00",
    bodyText:
      "If you experience data loading or transaction issues on Arbitrum, please use a free RPC URL from Alchemy.",
    buttons: [
      {
        text: "Learn More",
        link: "https://xdx.exchange/docs",
        newTab: true,
      },
    ],
  },
  {
    id: "arbitrum-nitro-upgrade",
    title: "Arbitrum Nitro Upgrade",
    isActive: true,
    validTill: "31 Aug 2022, 20:00",
    bodyText: "The Arbitrum Nitro upgrade has been completed.",
    buttons: [
      {
        text: "Read More",
        link: "https://xdx.exchange/docs",
        newTab: true,
      },
    ],
  },
];
