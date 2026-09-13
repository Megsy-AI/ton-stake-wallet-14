import gramAsset from "@/assets/gram.png.asset.json";
import usdtAsset from "@/assets/usdt.png.asset.json";
import notAsset from "@/assets/not.jpg.asset.json";
import dogsAsset from "@/assets/dogs.png.asset.json";

const icons = {
  GRAM: { src: gramAsset.url, alt: "Gram" },
  TON: { src: gramAsset.url, alt: "Gram" },
  USDT: { src: usdtAsset.url, alt: "Tether USD" },
  NOT: { src: notAsset.url, alt: "Notcoin" },
  DOGS: { src: dogsAsset.url, alt: "Dogs" },
} satisfies Record<string, { src: string; alt: string }>;

export function CoinIcon({ symbol, className = "h-6 w-6" }: { symbol: string; className?: string }) {
  const icon = icons[symbol as keyof typeof icons] ?? icons.GRAM;
  return (
    <img
      src={icon.src}
      alt={`${icon.alt} token`}
      width={32}
      height={32}
      className={`${className} shrink-0 rounded-full object-cover`}
    />
  );
}