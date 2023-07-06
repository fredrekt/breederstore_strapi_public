/**
 * A set of functions called "actions" for `statistic`
 */

export default {
  getStats: async (ctx, next) => {
    try {
      await next();
      const breederId = ctx.state.user.breederId;
      let stats = {
        total: 0,
        pups: 0,
        upcoming: 0,
        studs: 0,
        showcase: 0,
        orders: 0
      }

      stats.total = await strapi.db.query("api::animal.animal").count({
        where: {
          breeder: breederId
        }
      });

      stats.pups = await strapi.db.query("api::animal.animal").count({
        where: {
          breeder: breederId,
          categories: [2]
        }
      });

      stats.upcoming = await strapi.db.query("api::animal.animal").count({
        where: {
          breeder: breederId,
          categories: [4]
        }
      });

      stats.studs = await strapi.db.query("api::animal.animal").count({
        where: {
          breeder: breederId,
          categories: [1]
        }
      });

      stats.showcase = await strapi.db.query("api::animal.animal").count({
        where: {
          breeder: breederId,
          categories: [3]
        }
      });

      stats.orders = await strapi.db.query("api::order.order").count({
        where: {
          breeder: breederId
        }
      });

      return stats;
    } catch (err) {
      ctx.body = err;
    }
  }
};
