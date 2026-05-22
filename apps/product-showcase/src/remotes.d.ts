declare module "product_card/ProductCard" {
  type Product = {
    id: string;
    name: string;
    price: number;
    image: string;
  };

  type AddToCartPayload = {
    productId: string;
    quantity: number;
  };

  type MountProductCardProps = {
    product?: Product;
    productId?: string;
    apiBaseUrl?: string;
    defaultQuantity?: number;
    actionLabel?: string;
    hideQuantity?: boolean;
    onProductClick?: (productId: string) => void;
    onAddToCart?: (payload: AddToCartPayload) => void;
  };

  export function mountProductCard(
    containerElement: HTMLElement,
    props: MountProductCardProps,
  ): () => void;
}
