/**
 * animal controller
 */

import { factories } from "@strapi/strapi";
const stripe = require("stripe")(
  process.env.STRAPI_ADMIN_TEST_STRIPE_SECRET_KEY
);
export default factories.createCoreController("api::animal.animal");

const convertDecimalToCents = (decimalValue) => {
  const centsValue = decimalValue * 100;
  const roundedCents = Math.round(centsValue);
  return roundedCents;
};

module.exports = factories.createCoreController(
  "api::animal.animal",
  ({ strapi }) => ({
    create: async (ctx, next) => {
      strapi.log.info(JSON.stringify(ctx.request.body.data));

      // allow only stripe connected accounts setup successfully
      strapi.log.info(
        `breeder stripe account id: ${ctx.state.user.stripeAccountId}`
      );
      if (!ctx.state.user.stripeAccountId) return;

      // create stripe product
      const createStripeProduct = await stripe.products.create(
        {
          name: ctx.request.body.data.name,
          default_price_data: {
            currency: "AUD",
            unit_amount_decimal: convertDecimalToCents(
              ctx.request.body.data.price
            ),
          },
          description: ctx.request.body.data.bio,
        },
        {
          stripeAccount: ctx.state.user.stripeAccountId,
        }
      );
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
          stripeAccount: ctx.state.user.stripeAccountId,
        }
      );
      const animal = await strapi.entityService.create("api::animal.animal", {
        data: {
          ...ctx.request.body.data,
          breeder: ctx.state.user.breederId,
          publishedAt: new Date().toISOString(),
          stripeProductId: createStripeProduct.id,
          stripePaymentLink: paymentLink.url,
          stripeProductJSON: createStripeProduct,
          stripePaymentLinkJSON: paymentLink,
          stripePaymentLinkId: paymentLink.id
        },
      });
      return animal;
    },
    getListing: async (ctx, next) => {
      const { id } = ctx.request.params; // category id
      const breederId = ctx.state.user.breederId;
      strapi.log.info(`breeder id: ${breederId} category id: ${id}`);
      const listing = await strapi.db.query("api::animal.animal").findMany({
        where: {
          $and: [
            {
              breeder: breederId,
            },
            {
              categories: [id],
            },
          ],
        },
        populate: ["breeder", "images", "categories"],
        orderBy: {
          createdAt: "desc",
        },
      });

      return listing;
    },
    update: async (ctx, next) => {
      strapi.log.info(
        `update product: ${JSON.stringify(ctx.request.body.data)}`
      );
      const updateProduct = await strapi.entityService.update(
        "api::animal.animal",
        ctx.params.id,
        {
          data: {
            ...ctx.request.body.data,
            updatedAt: new Date().toISOString(),
          },
        }
      );
      const currentProduct = await strapi.entityService.findOne(
        "api::animal.animal",
        ctx.params.id,
        {
          populate: {
            breeder: true,
            images: true,
            categories: true,
          },
        }
      );
      if (currentProduct.stripeProductId && ctx.state.user.stripeAccountId) {
        let updateData: any = {};
        updateData.description = currentProduct.bio;
        updateData.name = currentProduct.name;
        if (Array.isArray(currentProduct.images) && currentProduct.images) {
          updateData.images = currentProduct.images.map((data) => data.url);
        }
        await stripe.products.update(
          currentProduct.stripeProductId,
          updateData,
          {
            stripeAccount: ctx.state.user.stripeAccountId,
          }
        );
      }
      return updateProduct;
    },
    delete: async (ctx, next) => {
      const currentProduct = await strapi.entityService.findOne(
        "api::animal.animal",
        ctx.params.id,
        {
          populate: {
            breeder: true,
            images: true,
            categories: true,
          },
        }
      );
      if (
        currentProduct.stripeProductId &&
        currentProduct.stripePaymentLinkJSON &&
        ctx.state.user.stripeAccountId
      ) {
        await stripe.products.update(
          currentProduct.stripeProductId,
          {
            active: false,
          },
          {
            stripeAccount: ctx.state.user.stripeAccountId,
          }
        );
        await stripe.paymentLinks.update(
          currentProduct.stripePaymentLinkJSON.id,
          {
            active: false,
          },
          {
            stripeAccount: ctx.state.user.stripeAccountId,
          }
        );
      }
      return await strapi.entityService.delete(
        "api::animal.animal",
        ctx.params.id
      );
    },
  })
);
