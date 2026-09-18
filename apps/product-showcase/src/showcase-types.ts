export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
};

export type Showcase = {
  id: string;
  showcaseTitle: string;
  productIds: string[];
};

export type MountProductCardProps = {
  product?: Product;
  productId?: string;
  apiBaseUrl?: string;
  actionLabel?: string;
  hideQuantity?: boolean;
  variant?: "default" | "compact";
};

export type MountProductCard = (
  containerElement: HTMLElement,
  props: MountProductCardProps,
) => (() => void) | void;

export type ProductShowcaseDisplayMode = "inline" | "modal";

export type ProductShowcaseConfiguration = {
  showcase?: Showcase;
  showcaseId?: string;
  products?: Product[];
  productIds?: string[];
  title?: string;
  apiBaseUrl?: string;
  fallbackTitle?: string;
  actionLabel?: string;
  hideQuantity?: boolean;
  displayMode?: ProductShowcaseDisplayMode;
  defaultCollapsed?: boolean;
  mountProductCard?: MountProductCard;
};

export type ProductShowcaseElementInstance = HTMLElement & {
  config?: ProductShowcaseConfiguration;
};
