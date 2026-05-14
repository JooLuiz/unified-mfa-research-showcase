import fetchJson from "./fetchJson";
import { MOCK_API_BASE_URL } from "./constants";

async function loadMockData(appState) {
  const [
    postsResponse,
    bannersResponse,
    showcasesResponse,
  ] = await Promise.all([
    fetchJson(`${MOCK_API_BASE_URL}/posts`),
    fetchJson(`${MOCK_API_BASE_URL}/banners`),
    fetchJson(`${MOCK_API_BASE_URL}/showcases`),
  ]);

  appState.posts = postsResponse.items;
  appState.banners = bannersResponse;
  appState.showcases = showcasesResponse;
}

export default loadMockData;
