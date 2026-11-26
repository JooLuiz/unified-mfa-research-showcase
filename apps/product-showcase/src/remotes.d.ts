declare module "product_card/ProductCard" {
  type Product = {
    id: string;
    name: string;
    price: number;
    image: string;
  };

  type MountProductCardProps = {
    product?: Product;
    productId?: string;
    apiBaseUrl?: string;
    defaultQuantity?: number;
    actionLabel?: string;
    actionIntent?: "add-to-cart" | "open-product";
    hideQuantity?: boolean;
  };

  export function mountProductCard(
    containerElement: HTMLElement,
    props: MountProductCardProps,
  ): () => void;
}
