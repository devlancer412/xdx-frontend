// Make requests to CryptoCompare API
export async function makeApiRequest(path: string) {
  try {
    const response = await fetch(path);
    return response.json();
  } catch (error: any) {
    console.log("Backend issue: ", error.status);
  }
}

export function parseFullSymbol(fullSymbol: string) {
  const match = fullSymbol.match(/(\w+)\/(\w+)$/);
  if (!match) {
    return null;
  }

  return {
    fromSymbol: match[1],
    toSymbol: match[2],
  };
}
