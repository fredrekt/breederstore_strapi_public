const stripe = require("stripe")(
  process.env.STRAPI_ADMIN_TEST_STRIPE_SECRET_KEY
);
const convertDecimalToCents = (decimalValue) => {
  const centsValue = decimalValue * 100;
  const roundedCents = Math.round(centsValue);
  return roundedCents;
};

const createStripeProduct = async (
  id: number,
  name: string,
  price: number,
  bio: string,
  images: any[]
) => {
    strapi.log.info(`creating stripe product (animal).`)
    let createProductData: any = {};
    createProductData.name = name;
    createProductData.default_price_data = {
      currency: "AUD",
      unit_amount_decimal: convertDecimalToCents(price)
    }
    createProductData.description = bio ? bio : 'Breeder product description.'
    if (Array.isArray(images) && images) {
      createProductData.images = images.map((data) => data.url).slice(0, 8);;
    }
  const createStripeProduct = await stripe.products.create(createProductData);
  // create stripe payment link
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price: createStripeProduct.default_price,
        quantity: 1,
      },
    ],
  });
  if (createStripeProduct && paymentLink) {
    return await strapi.entityService.update("api::animal.animal", id, {
      data: {
        stripeProductId: createStripeProduct.id,
        stripePaymentLink: paymentLink.url,
        stripeProductJSON: createStripeProduct,
        stripePaymentLinkJSON: paymentLink,
        updatedAt: new Date().toISOString(),
      },
    });
  }
};

export default {
  myJob: {
    task: async ({ strapi }) => {
      // running cron job update existing products;
      const products = await strapi.entityService.findMany(
        "api::animal.animal",
        {
          fields: ["*"],
          filters: {
            $and: [
              {
                stripeProductId: {
                  $null: true,
                },
              },
              {
                stripePaymentLink: {
                  $null: true,
                },
              },
            ],
          },
          sort: { createdAt: "DESC" },
          populate: { images: true },
        }
      );
      if (Array.isArray(products) && products.length) {
        for await (let product of products) {
            await createStripeProduct(
              product.id,
              product.name,
              product.price,
              product.bio,
              product.images
            );
          }
      }
      strapi.log.info(`Finished running stripe product sync update.`);
    },
    options: {
      rule: "* * * * *",
    },
  },
};
