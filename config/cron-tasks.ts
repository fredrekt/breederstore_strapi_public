const stripe = require("stripe")(
  process.env.STRAPI_ADMIN_TEST_STRIPE_SECRET_KEY
);
const convertDecimalToCents = (decimalValue) => {
  const centsValue = decimalValue * 100;
  const roundedCents = Math.round(centsValue);
  return roundedCents;
};

const createBreederStripeConnectedAccount = async (breeder: any, user: any) => {
  let stripeAccountId: string = "";
  if (user.stripeAccountId && user.stripeAccountLink) {
    return user.stripeAccountId;
  }
  // create stripe account
  const stripeAccount = await stripe.accounts.create({
    type: "express",
    country: "AU",
    email: user.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    business_profile: {
      name: breeder.registryName,
      url: `${process.env.CLIENT_URL}/breeder/${breeder.id}`,
    },
    settings: {
      payouts: {
        schedule: {
          delay_days: 5,
        },
      },
    },
  });

  if (stripeAccount) {
    // create stripe account link for onboarding (creating payout account)
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccount.id,
      refresh_url: "https://example.com/reauth",
      return_url: "https://example.com/return",
      type: "account_onboarding",
    });
    if (accountLink) {
      stripeAccountId = stripeAccount.id;
      const updateQuery = {
        where: {
          id: user.id,
        },
        data: {
          publishedAt: new Date().toISOString(),
          breeder: breeder.id,
          stripeAccountId: stripeAccount.id,
          stripeAccountJSON: stripeAccount,
          stripeAccountLink: accountLink.url,
          stripeAccountLinkJSON: accountLink,
        },
      };
      await strapi.db
        .query("plugin::users-permissions.user")
        .update(updateQuery);
    }
  }
  return stripeAccountId;
};

const createStripeProduct = async (
  breeder: any,
  user: any,
  id: number,
  name: string,
  price: number,
  bio: string,
  images: any[]
) => {
  strapi.log.info(`creating stripe product (animal).`);
  let createProductData: any = {};
  createProductData.name = name;
  createProductData.default_price_data = {
    currency: "AUD",
    unit_amount_decimal: convertDecimalToCents(price),
  };
  createProductData.description = bio ? bio : "Breeder product description.";
  if (Array.isArray(images) && images) {
    createProductData.images = images.map((data) => data.url).slice(0, 8);
  }
  const connectedStripeAccountId = await createBreederStripeConnectedAccount(
    breeder,
    user
  );
  // create stripe product
  const createStripeProduct = await stripe.products.create(createProductData, {
    stripeAccount: connectedStripeAccountId,
  });
  // create stripe payment link
  const paymentLink = await stripe.paymentLinks.create(
    {
      line_items: [
        {
          price: createStripeProduct.default_price,
          quantity: 1,
        },
      ],
    },
    {
      stripeAccount: connectedStripeAccountId,
    }
  );
  if (createStripeProduct && paymentLink) {
    return await strapi.entityService.update("api::animal.animal", id, {
      data: {
        stripeProductId: createStripeProduct.id,
        stripePaymentLink: paymentLink.url,
        stripeProductJSON: createStripeProduct,
        stripePaymentLinkJSON: paymentLink,
        stripePaymentLinkId: paymentLink.id,
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
                stripePaymentLinkId: {
                  $null: true,
                },
              },
              {
                "breeder.user.isSubscribed": true,
              },
              {
                "breeder.user.stripeAccountLink": {
                  $null: true,
                },
              },
              {
                "breeder.user.stripeAccountId": {
                  $null: true,
                },
              },
            ],
          },
          sort: { createdAt: "DESC" },
          populate: ["images", "breeder", "breeder.user"],
        }
      );
      if (Array.isArray(products) && products.length) {
        for await (let product of products) {
          await createStripeProduct(
            product.breeder,
            product.breeder.user,
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
