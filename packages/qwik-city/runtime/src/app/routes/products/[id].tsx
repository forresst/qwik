import { Resource, component$, Host, useStore } from '@builder.io/qwik';
import { useEndpoint, useLocation, EndpointHandler, DocumentHead } from '~qwik-city-runtime';
import os from 'os';

export default component$(() => {
  const { params, pathname } = useLocation();
  const store = useStore({ productFetchData: '' });

  const resource = useEndpoint<typeof onGet>();

  return (
    <Host>
      <h1>Product: {params.id}</h1>

      <Resource
        resource={resource}
        onPending={() => <p>Loading</p>}
        onRejected={(e) => <p>{e}</p>}
        onResolved={(product) => {
          return (
            <>
              <p>Price: {product.price}</p>
              <p>{product.description}</p>
            </>
          );
        }}
      />

      <p>(Artificial response delay of 200ms)</p>

      <p>
        <button
          onClick$={async () => {
            const rsp = await fetch(pathname, {
              headers: { accept: 'application/json' },
            });
            store.productFetchData = JSON.stringify(await rsp.json(), null, 2);
          }}
        >
          fetch("{pathname}") data
        </button>
      </p>

      <pre>
        <code>{store.productFetchData}</code>
      </pre>

      <hr />

      <ul>
        <li>
          <a href="/products/jacket" data-test-link="products-jacket">
            Jacket
          </a>
        </li>
        <li>
          <a href="/products/hat">Hat</a>
        </li>
        <li>
          <a href="/products/shirt" data-test-link="products-shirt">
            T-Shirt (Redirect to /products/tshirt)
          </a>
        </li>
        <li>
          <a href="/products/hoodie" data-test-link="products-hoodie">
            Hoodie (404 Not Found)
          </a>
        </li>
      </ul>
    </Host>
  );
});

export const head: DocumentHead<ProductData | null> = ({ params }) => {
  return {
    title: `Product ${params.id}`,
  };
};

export const onGet: EndpointHandler<EndpointData> = async ({ params, response }) => {
  // Serverside Endpoint
  // During SSR, this method is called directly on the server and returns the data object
  // On the client, this same data can be requested with fetch() at the same URL, but also
  // requires the "accept: application/json" request header.

  if (params.id === 'shirt') {
    // Redirect, which will skip any rendering and the server will immediately redirect
    return response.redirect('/products/tshirt');
  }

  const productPrice = PRODUCT_DB[params.id];
  if (!productPrice) {
    // Product data not found
    // but the data is still given to the renderer to decide what to do
    response.status = 404;
    return null;
  }

  response.headers.set('Cache-Control', 'no-cache, no-store, no-fun');

  return async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 200));

    return {
      // Found the product data
      // This same data is passed to the head() function
      // and in the component$() it can be access with useEndpoint()
      productId: params.id,
      price: productPrice,
      description: `Node ${process.versions.node} ${os.platform()} ${os.arch()} ${
        os.cpus()[0].model
      }`,
    };
  };
};

// Our pretty awesome database of prices
const PRODUCT_DB: Record<string, string> = {
  hat: '$21.96',
  jacket: '$48.96',
  tshirt: '$18.96',
};

type EndpointData = ProductData;

interface ProductData {
  productId: string;
  price: string;
  description: string;
}
