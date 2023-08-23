const stripe = require("stripe")(
  process.env.STRAPI_ADMIN_TEST_STRIPE_SECRET_KEY
);
const unparsed = require("koa-body/unparsed.js");

// order payment workflow
const createStripePaymentLog = async (
  accountId: string,
  paymentData: any,
  customerEmail: string
) => {
  if (!accountId || !paymentData || !customerEmail) return;
  const currentUser = await strapi.db
    .query("plugin::users-permissions.user")
    .findOne({
      where: {
        email: customerEmail,
      },
    });
  if (!currentUser) return;
  const createPaymentLog = await strapi.entityService.create(
    "api::payment-log.payment-log",
    {
      data: {
        type: "order",
        stripePaymentIntentId: paymentData.payment_intent,
        stripePaymentLinkId: paymentData.payment_link,
        stripePaymentJSON: paymentData,
        stripeAccountId: accountId,
        userCustomer: currentUser,
        userCustomerId: currentUser.id,
        publishedAt: new Date().toISOString(),
      },
    }
  );
  if (createPaymentLog) {
    const animal = await strapi.db.query("api::animal.animal").findOne({
      where: {
        stripePaymentLinkId: paymentData.payment_link,
      },
      populate: ["breeder"],
    });
    if (animal && animal.breeder && currentUser) {
      // animal/product remove from listing
      await strapi.entityService.update("api::animal.animal", animal.id, {
        data: {
          publishedAt: new Date().toISOString(),
          isDeleted: true,
        },
      });
      strapi.log.info(`current animal: ${JSON.stringify(animal)}`);
      strapi.log.info(`current breeder: ${JSON.stringify(animal.breeder)}`);
      strapi.log.info(`customer user details: ${JSON.stringify(currentUser)}`);
    }
  }
  return createPaymentLog;
};

// breeder access subscription
const processBreederSubscription = async (
  customerEmail: string,
  payment_status: string,
  subscription: string,
  customerId: string
) => {
  const userCustomer = await strapi.db
    .query("plugin::users-permissions.user")
    .findOne({
      where: {
        email: customerEmail,
      },
      populate: ["breeder"],
    });
  if (!userCustomer && userCustomer.isBuyer) return;
  if (payment_status !== "paid" || !subscription) return;

  const updateQuery = {
    where: {
      id: userCustomer.id,
    },
    data: {
      updatedAt: new Date().toISOString(),
      isSubscribed: true,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription,
    },
  };
  await strapi.db.query("plugin::users-permissions.user").update(updateQuery);

  strapi.log.info(
    `processing breeder subscritpion: user id: ${userCustomer.id} status: ${payment_status} subscription id: ${subscription}`
  );
};

module.exports = {
  stripeWebhook: async (ctx) => {
    try {
      // socket io instance creation
      // const io = require("socket.io")(strapi.server.httpServer, {
      //   cors: {
      //     origin: "*",
      //     methods: ["GET", "POST"],
      //     allowedHeaders: ["my-custom-header"],
      //     credentials: true,
      //   },
      // });

      // stripe construct event accounts
      const event = await stripe.webhooks.constructEvent(
        ctx.request.body[unparsed],
        ctx.request.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_ENDPOINT_SECRET
      );

      // handle stripe events
      switch (event.type) {
        case "checkout.session.completed":
          strapi.log.info(
            `stripe webhook event data: ${JSON.stringify(event)}`
          );
          const clientEmail = event.data.object.customer_details.email;
          if (clientEmail && event.data.object) {
            const eventData = {
              email: clientEmail,
              message: "Stripe checkout payment successful",
              data: event.data.object,
            };

            // stripe payment breeder subscription
            if (
              eventData.data.payment_link ===
              process.env.BREEDER_SUBSCRIPTION_PLINK
            ) {
              strapi.log.info(`stripe breeder subscription`);
              const { subscription, payment_status, customer } =
                event.data.object;
              if (!subscription || !payment_status || !customer) return;
              await processBreederSubscription(
                clientEmail,
                payment_status,
                subscription,
                customer
              );
            }

            strapi.log.info(
              `Emitting stripePaymentSuccess event: ${JSON.stringify(
                eventData
              )}`
            );
          }
          break;

        default:
          break;
      }

      ctx.send({ received: true }); // Send a response to Stripe
    } catch (error) {
      strapi.log.error("Stripe webhook error:", error);
      ctx.response.status = 400;
      ctx.send({ error: "Webhook processing failed" });
    }
  },
  stripeWebhookConnectedAccounts: async (ctx) => {
    try {
      // socket io instance creation
      // const io = require("socket.io")(strapi.server.httpServer, {
      //   cors: {
      //     origin: "*",
      //     methods: ["GET", "POST"],
      //     allowedHeaders: ["my-custom-header"],
      //     credentials: true,
      //   },
      // });

      // stripe construct event connected accounts
      const connectedEvent = await stripe.webhooks.constructEvent(
        ctx.request.body[unparsed],
        ctx.request.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_ENDPOINT_SECRET_CONNECTED_ACCOUNTS
      );

      // handle stripe connected account events
      switch (connectedEvent.type) {
        case "checkout.session.completed":
          strapi.log.info(
            `stripe webhook event data: ${JSON.stringify(connectedEvent)}`
          );
          const clientEmail = connectedEvent.data.object.customer_details.email;
          if (clientEmail && connectedEvent.data.object) {
            const eventData = {
              email: clientEmail,
              message: "Stripe checkout payment successful",
              data: connectedEvent.data.object,
            };

            // io.emit("useCheckoutStripeSuccess", eventData);

            await createStripePaymentLog(
              connectedEvent.account,
              connectedEvent.data.object,
              clientEmail
            );

            // stripe payment breeder subscription
            if (
              eventData.data.payment_link ===
              process.env.BREEDER_SUBSCRIPTION_PLINK
            ) {
              strapi.log.info(`stripe breeder subscription`);
              const { subscription, payment_status, customer } =
                connectedEvent.data.object;
              if (!subscription || !payment_status || !customer) return;
              await processBreederSubscription(
                clientEmail,
                payment_status,
                subscription,
                customer
              );
            }

            strapi.log.info(
              `Emitting stripePaymentSuccess event: ${JSON.stringify(
                eventData
              )}`
            );
          }
          break;

        default:
          break;
      }

      ctx.send({ received: true }); // Send a response to Stripe
    } catch (error) {
      strapi.log.error("Stripe webhook error:", error);
      ctx.response.status = 400;
      ctx.send({ error: "Webhook processing failed" });
    }
  },
};
