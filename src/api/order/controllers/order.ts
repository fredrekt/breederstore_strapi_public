/**
 * order controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::order.order');

module.exports = factories.createCoreController('api::order.order', 
({ strapi }) => ({
    find: async (ctx, next) => {
        let { status } = ctx.request.query.filters;
        let listing = [];

        if (ctx.state.user.isBuyer) {
            strapi.log.info(`running orders from users. ${ctx.state.user.id} filters: ${status['$eq']}`);
            listing = await strapi.db.query("api::order.order").findMany({
                where: {
                    ordered_by: ctx.state.user.id,
                    status: status['$eq'] === 'All' ? 'PENDING' : status['$eq']
                },
                populate: ['breeder', 'animal', 'animal.images', 'breeder.avatar']
            });
        } else {
            const { breeder } = await strapi.entityService.findOne(
                "plugin::users-permissions.user",
                ctx.state.user.id,
                {
                  fields: ["id"],
                  populate: { breeder: true },
                }
              );
            strapi.log.info(`running orders from owners (breeders: ${breeder.id}). ${ctx.state.user.id} filters: ${status['$eq']}`);
            listing = await strapi.db.query("api::order.order").findMany({
                where: {
                    breeder: breeder.id,
                    status: status['$eq'] === 'All' ? 'PENDING' : status['$eq']
                },
                populate: ['breeder', 'animal', 'ordered_by', 'animal.images', 'breeder.avatar']
            });
        }

    
        return listing;
    }
}))