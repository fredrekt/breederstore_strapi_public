/**
 * notification controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::notification.notification');

module.exports = factories.createCoreController('api::notification.notification',
({ strapi }) => ({
    find: async (ctx, next) => {
        let notifications = [];
        notifications = await strapi.db.query('api::notification.notification').findMany({
            where: {
                user: ctx.state.user.id
            },
            populate: ['user']
        })
        return notifications;
    }
}))
