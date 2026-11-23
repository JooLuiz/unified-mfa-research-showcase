import requestJson from "./requestJson";
import { MOCK_API_BASE_URL } from "./constants";

async function loadMockData(appState) {
  const [
    productsResponse,
    showcasesResponse,
    bannersResponse,
  ] = await Promise.all([
    requestJson(`${MOCK_API_BASE_URL}/products`),
    requestJson(`${MOCK_API_BASE_URL}/showcases`),
    requestJson(`${MOCK_API_BASE_URL}/banners`),
  ]);

  appState.products = productsResponse.items;
  appState.productsById = appState.products.reduce((accumulator, product) => {
    accumulator[product.id] = product;
    return accumulator;
  }, {});
  appState.showcases = showcasesResponse;
  appState.banners = bannersResponse;
}

export default loadMockData;
