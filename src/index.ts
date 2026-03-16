import { Configuration, PortfolioApi } from "kalshi-typescript";
import { config } from "./config";

async function main(): Promise<void> {
  const configuration = new Configuration({
    apiKey: config.apiKey,
    basePath: config.basePath,
    ...(config.privateKeyPem
      ? { privateKeyPem: config.privateKeyPem }
      : config.privateKeyPath
        ? { privateKeyPath: config.privateKeyPath }
        : {}),
  });

  const portfolioApi = new PortfolioApi(configuration);

  try {
    const balance = await portfolioApi.getBalance();
    const cents = balance.data.balance ?? 0;
    console.log(`Balance: $${(cents / 100).toFixed(2)}`);
  } catch (err) {
    console.error("Kalshi API error:", err);
    process.exit(1);
  }
}

main();
