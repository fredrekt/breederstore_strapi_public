/**
 * animal controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController("api::animal.animal");

module.exports = factories.createCoreController(
  "api::animal.animal",
  ({ strapi }) => ({
    create: async (ctx, next) => {
      strapi.log.info(JSON.stringify(ctx.request.body.data))
      return await strapi.entityService.create("api::animal.animal", {
        data: {
          ...ctx.request.body.data,
          breeder: ctx.state.user.breederId,
          publishedAt: new Date().toISOString(),
        }
      })
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
        populate: ['breeder', 'images', 'categories']
      });

      return listing;
    },
  })
);
