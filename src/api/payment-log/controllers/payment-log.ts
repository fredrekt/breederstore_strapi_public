/**
 * payment-log controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::payment-log.payment-log');


module.exports = factories.createCoreController("api::payment-log.payment-log", ({ strapi }) => ({
    verifyPayment: async (ctx, next) => {
        // verify payment for order
        let paid: boolean = false;
        const userId: number = ctx.state.user.id;
        const id = ctx.request.body.data.stripePaymentLinkId; // animal stripePaymentLinkId

        const currentLog = await strapi.db.query("api::payment-log.payment-log").findOne({
            where: {
                $and: [
                    {
                        stripePaymentLinkId: id,
                    },
                    {
                        userCustomerId: userId
                    },
                    {
                        type: 'order'
                    }
                ]
            },
        });
        if (currentLog) {
            delete ctx.request.body.data.stripePaymentLinkId;
            const currentOrder = await strapi.db.query("api::order.order").findOne({
                where: {
                    $and: [
                        {
                            stripePaymentIntentId: currentLog.stripePaymentIntentId,
                        },
                        {
                            ordered_by: userId
                        },
                    ]
                },
            });
            if (!currentOrder) {
                const createOrder = await strapi.entityService.create("api::order.order", {
                    data: {
                        ...ctx.request.body.data,
                        ordered_by: currentLog.userCustomerId,
                        stripePaymentIntentId: currentLog.stripePaymentIntentId,
                        publishedAt: new Date().toISOString(),
                    }
                });
                
                const { user } = await strapi.entityService.findOne(
                    "api::breeder.breeder",
                    ctx.request.body.data.breeder,
                    {
                      fields: ["id"],
                      populate: { user: true },
                    }
                );

                if (createOrder && user) {
                    paid = true;
                    // manually create notification for order placed
                    await strapi.entityService.create("api::notification.notification", {
                    data: {
                        message: `You have received an order from ${ctx.state.user.username}.`,
                        type: "order",
                        user: user,
                        publishedAt: new Date().toISOString(),
                    },
                    });
                }
            }
        }
        strapi.log.info(`verifying payment: ${JSON.stringify(currentLog)}`);
        return paid;
    }
}))