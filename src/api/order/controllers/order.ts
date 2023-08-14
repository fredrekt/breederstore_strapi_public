/**
 * order controller
 */

import { factories } from "@strapi/strapi";
const stripe = require("stripe")(
  process.env.STRAPI_ADMIN_TEST_STRIPE_SECRET_KEY
);
export default factories.createCoreController("api::order.order");

module.exports = factories.createCoreController(
  "api::order.order",
  ({ strapi }) => ({
    find: async (ctx, next) => {
      let { status } = ctx.request.query.filters;
      let listing = [];

      if (ctx.state.user.isBuyer) {
        strapi.log.info(
          `running orders from users. ${ctx.state.user.id} filters: ${status["$eq"]}`
        );
        listing = await strapi.db.query("api::order.order").findMany({
          where: {
            ordered_by: ctx.state.user.id,
            status: status["$eq"] === "All" ? "PENDING" : status["$eq"],
          },
          populate: ["breeder", "animal", "animal.images", "breeder.avatar"],
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
        strapi.log.info(
          `running orders from owners (breeders: ${breeder.id}). ${ctx.state.user.id} filters: ${status["$eq"]}`
        );
        listing = await strapi.db.query("api::order.order").findMany({
          where: {
            breeder: breeder.id,
            status: status["$eq"] === "All" ? "PENDING" : status["$eq"],
          },
          populate: [
            "breeder",
            "animal",
            "ordered_by",
            "animal.images",
            "breeder.avatar",
          ],
        });
      }

      return listing;
    },
    create: async (ctx, next) => {
      //   const io = require("socket.io")(strapi.server.httpServer, {
      //     cors: {
      //       // cors setup
      //       origin: "*",
      //       methods: ["GET", "POST"],
      //       allowedHeaders: ["my-custom-header"],
      //       credentials: true,
      //     },
      //   });

      // io.on("connection", async function (socket) {
      //     const notification = await strapi.entityService.create(
      //       "api::notification.notification",
      //       {
      //         data: {
      //           message: `You have received an order from ${ctx.state.user.username}.`,
      //           type: "order",
      //           user: 51,
      //           publishedAt: new Date().toISOString(),
      //         },
      //       }
      //     );
      //     if (notification) {
      //       io.emit("newNotification", {
      //         ...notification,
      //       });
      //       return await strapi.entityService.create("api::order.order", {
      //         data: {
      //           ...ctx.request.body.data,
      //           publishedAt: new Date().toISOString(),
      //         },
      //       });
      //     }
      //   });

      const { user } = await strapi.entityService.findOne(
        "api::breeder.breeder",
        ctx.request.body.data.breeder,
        {
          fields: ["id"],
          populate: { user: true },
        }
      );

      const animal = await strapi.entityService.findOne(
        "api::animal.animal",
        ctx.request.body.data.animal
      );

      strapi.log.info(`user breeder: ${JSON.stringify(user)}`);
      if (user) {
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

      // if payment success
      if (ctx.request.body.data.paymentStatus === 'COMPLETED') {
        await strapi.entityService.update(
          "api::animal.animal",
          animal.id,
          {
            data: {
              publishedAt: new Date().toISOString(),
              isDeleted: true
            }
          }
        )
      }

      if (animal) {
        return await strapi.entityService.create("api::order.order", {
          data: {
            ...ctx.request.body.data,
            publishedAt: new Date().toISOString(),
          },
        });
      }
    },
    update: async (ctx, next) => {
      strapi.log.info(`updating order`);
      const updateOrder = await strapi.entityService.update(
        "api::order.order",
        ctx.params.id,
        {
          data: {
            ...ctx.request.body.data,
            updatedAt: new Date().toISOString(),
          },
        }
      );

      const order = await strapi.entityService.findOne("api::order.order", ctx.params.id, {
        populate: ["breeder", "animal"],
      });

      const orderStatus: string = ctx.request.body.data.status;

      strapi.log.info(`order status: ${orderStatus}`);

      switch (orderStatus) {
        case "CANCELLED":
          // refund
          strapi.log.info(`start refund here. ${JSON.stringify(order)}`);
          if (order.stripePaymentIntentId) {
            await stripe.refunds.create({
              payment_intent: order.stripePaymentIntentId,
            });
          }
          break;
        case "DELIVERED":
          // delivered & remove from listing
          if (ctx.request.body.data.isDeliveredByBreeder && order.animal) {
            strapi.log.info(`marking delivered: ${JSON.stringify(order.animal)}`)
            await strapi.entityService.update(
              "api::animal.animal",
              order.animal.id,
              {
                data: {
                  publishedAt: new Date().toISOString(),
                  isDeleted: true
                }
              }
            )
          }
          break;
        case "IN_TRANSIT":
            // in transit & remove from listing
            if (order.animal) {
              strapi.log.info(`marking in transit/on delivery: ${JSON.stringify(order.animal)}`)
              await strapi.entityService.update(
                "api::animal.animal",
                order.animal.id,
                {
                  data: {
                    publishedAt: new Date().toISOString(),
                    isDeleted: true
                  }
                }
              )
            }
          break;
        default:
          break;
      }

      return updateOrder;
    }
  })
);
